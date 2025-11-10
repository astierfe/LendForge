// subgraph/src/collateral-manager.ts - v3.0 - Multi-collateral tracking
import { BigDecimal, BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  CollateralDeposited,
  CollateralWithdrawn,
  AssetAdded,
  CollateralManager
} from "../generated/CollateralManager/CollateralManager"
import {
  User,
  Position,
  UserCollateral,
  CollateralAsset,
  Transaction,
  GlobalMetric
} from "../generated/schema"
import {
  updateDailyMetricOnDeposit,
  updateDailyMetricOnWithdraw
} from "./daily-metrics"
import {
  getOrCreateUser,
  getOrCreatePosition
} from "./helpers"

const ZERO_BI = BigInt.zero()
const ETH_ADDRESS = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
const USDC_ADDRESS = Bytes.fromHexString("0xc47095ad18c67fba7e46d56bdbb014901f3e327b")
const DAI_ADDRESS = Bytes.fromHexString("0x2fa332e8337642891885453fd40a7a7bb010b71a")

// Helper function to calculate individual asset value in USD
function calculateAssetValueUSD(
  collateralManagerAddress: Address,
  userAddress: Address,
  assetAddress: Address,
  amount: BigInt
): BigInt {
  // Bind to CollateralManager contract to call getCollateralValueUSD
  let collateralManager = CollateralManager.bind(collateralManagerAddress)

  // Try to get total collateral value for the user
  let totalValueResult = collateralManager.try_getCollateralValueUSD(userAddress)

  if (totalValueResult.reverted) {
    // If call fails, return 0
    return ZERO_BI
  }

  return totalValueResult.value
}

function getOrCreateUserCollateral(userId: string, assetId: string): UserCollateral {
  let userCollateralId = userId + "-" + assetId
  let userCollateral = UserCollateral.load(userCollateralId)

  if (!userCollateral) {
    userCollateral = new UserCollateral(userCollateralId)
    userCollateral.user = userId
    userCollateral.asset = assetId
    userCollateral.amount = ZERO_BI
    userCollateral.valueUSD = ZERO_BI
    userCollateral.updatedAt = BigInt.zero()
  }

  return userCollateral
}

function getOrCreateCollateralAsset(assetAddress: Bytes): CollateralAsset {
  let assetId = assetAddress.toHexString().toLowerCase()
  let asset = CollateralAsset.load(assetId)

  if (!asset) {
    asset = new CollateralAsset(assetId)

    // Hardcoded asset configurations (ANO_009 fix - Phase 1bis)
    if (assetAddress.equals(ETH_ADDRESS)) {
      asset.symbol = "ETH"
      asset.decimals = 18
      asset.ltv = 80
      asset.liquidationThreshold = 85
    } else if (assetAddress.equals(USDC_ADDRESS)) {
      asset.symbol = "USDC"
      asset.decimals = 6
      asset.ltv = 85
      asset.liquidationThreshold = 90
    } else if (assetAddress.equals(DAI_ADDRESS)) {
      asset.symbol = "DAI"
      asset.decimals = 18
      asset.ltv = 85
      asset.liquidationThreshold = 90
    } else {
      // Fallback for unknown assets
      asset.symbol = "UNKNOWN"
      asset.decimals = 18
      asset.ltv = 0
      asset.liquidationThreshold = 0
    }

    asset.enabled = true
    asset.totalDeposited = ZERO_BI
    asset.save()
  }

  return asset
}

function updateGlobalTVLByAsset(global: GlobalMetric, asset: Bytes, amountChange: BigInt, isDeposit: boolean): void {
  if (asset.equals(ETH_ADDRESS)) {
    if (isDeposit) {
      global.totalETHDeposited = global.totalETHDeposited.plus(amountChange)
      global.currentTVL = global.currentTVL.plus(amountChange)
    } else {
      global.totalETHDeposited = global.totalETHDeposited.minus(amountChange)
      global.currentTVL = global.currentTVL.minus(amountChange)
    }
  } else if (asset.equals(USDC_ADDRESS)) {
    if (isDeposit) {
      global.totalUSDCDeposited = global.totalUSDCDeposited.plus(amountChange)
      global.currentTVL = global.currentTVL.plus(amountChange)
    } else {
      global.totalUSDCDeposited = global.totalUSDCDeposited.minus(amountChange)
      global.currentTVL = global.currentTVL.minus(amountChange)
    }
  } else if (asset.equals(DAI_ADDRESS)) {
    if (isDeposit) {
      global.totalDAIDeposited = global.totalDAIDeposited.plus(amountChange)
      global.currentTVL = global.currentTVL.plus(amountChange)
    } else {
      global.totalDAIDeposited = global.totalDAIDeposited.minus(amountChange)
      global.currentTVL = global.currentTVL.minus(amountChange)
    }
  }

  if (global.currentTVL.gt(global.allTimeHighTVL)) {
    global.allTimeHighTVL = global.currentTVL
  }
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
  let user = getOrCreateUser(event.params.user.toHexString().toLowerCase(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)
  let asset = getOrCreateCollateralAsset(event.params.asset)
  let userCollateral = getOrCreateUserCollateral(user.id, asset.id)

  // Update user collateral
  userCollateral.amount = userCollateral.amount.plus(event.params.amount)
  userCollateral.updatedAt = event.block.timestamp

  // Calculate valueUSD by calling CollateralManager contract
  let totalValueUSD = calculateAssetValueUSD(
    event.address,
    event.params.user,
    event.params.asset,
    userCollateral.amount
  )
  userCollateral.valueUSD = totalValueUSD

  userCollateral.save()

  // Update asset total
  asset.totalDeposited = asset.totalDeposited.plus(event.params.amount)
  asset.save()

  // Update user lifetime deposits and totalCollateralUSD
  user.lifetimeDeposits = user.lifetimeDeposits.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.totalCollateralUSD = totalValueUSD
  user.save()

  // Update position totalCollateralUSD
  position.totalCollateralUSD = totalValueUSD
  position.updatedAt = event.block.timestamp
  position.save()

  // Create transaction
  let txType = event.params.asset.equals(ETH_ADDRESS) ? "DEPOSIT_ETH" : "DEPOSIT_ERC20"
  let txId = event.transaction.hash.toHexString() + "-" + txType + "-" + event.block.number.toString()
  let transaction = new Transaction(txId)
  transaction.position = position.id
  transaction.user = user.id
  transaction.type = txType
  transaction.asset = event.params.asset
  transaction.amount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.txHash = event.transaction.hash
  transaction.save()

  // Update global metrics
  let global = GlobalMetric.load("global")!
  global.totalVolumeDeposited = global.totalVolumeDeposited.plus(event.params.amount)
  global.updatedAt = event.block.timestamp

  updateGlobalTVLByAsset(global, event.params.asset, event.params.amount, true)
  global.save()

  // Update daily metrics
  updateDailyMetricOnDeposit(
    event.block.timestamp,
    event.params.amount,
    event.params.asset,
    user.id
  )
}

export function handleCollateralWithdrawn(event: CollateralWithdrawn): void {
  let user = getOrCreateUser(event.params.user.toHexString().toLowerCase(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)
  let asset = getOrCreateCollateralAsset(event.params.asset)
  let userCollateral = getOrCreateUserCollateral(user.id, asset.id)

  // Update user collateral
  userCollateral.amount = userCollateral.amount.minus(event.params.amount)
  userCollateral.updatedAt = event.block.timestamp

  // Recalculate valueUSD after withdrawal
  let totalValueUSD = calculateAssetValueUSD(
    event.address,
    event.params.user,
    event.params.asset,
    userCollateral.amount
  )
  userCollateral.valueUSD = totalValueUSD

  userCollateral.save()

  // Update asset total
  asset.totalDeposited = asset.totalDeposited.minus(event.params.amount)
  asset.save()

  // Update user totalCollateralUSD
  user.updatedAt = event.block.timestamp
  user.totalCollateralUSD = totalValueUSD
  user.save()

  // Update position totalCollateralUSD
  position.totalCollateralUSD = totalValueUSD
  position.updatedAt = event.block.timestamp
  position.save()

  // Create transaction
  let txType = event.params.asset.equals(ETH_ADDRESS) ? "WITHDRAW_ETH" : "WITHDRAW_ERC20"
  let txId = event.transaction.hash.toHexString() + "-" + txType + "-" + event.block.number.toString()
  let transaction = new Transaction(txId)
  transaction.position = position.id
  transaction.user = user.id
  transaction.type = txType
  transaction.asset = event.params.asset
  transaction.amount = event.params.amount
  transaction.timestamp = event.block.timestamp
  transaction.blockNumber = event.block.number
  transaction.txHash = event.transaction.hash
  transaction.save()

  // Update global metrics
  let global = GlobalMetric.load("global")!
  updateGlobalTVLByAsset(global, event.params.asset, event.params.amount, false)
  global.updatedAt = event.block.timestamp
  global.save()

  // Update daily metrics
  updateDailyMetricOnWithdraw(
    event.block.timestamp,
    event.params.amount,
    event.params.asset,
    user.id
  )
}

export function handleAssetAdded(event: AssetAdded): void {
  let asset = getOrCreateCollateralAsset(event.params.asset)

  // Update asset configuration
  asset.symbol = event.params.symbol
  asset.ltv = event.params.ltv.toI32()
  asset.liquidationThreshold = event.params.liquidationThreshold.toI32()
  asset.enabled = true
  asset.save()
}