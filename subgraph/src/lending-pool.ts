// subgraph/src/lending-pool.ts - v3.0 - Multi-collateral support
import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  Borrowed,
  Repaid,
  Liquidated
} from "../generated/LendingPool/LendingPool"
import {
  User,
  Position,
  Transaction,
  DailyMetric,
  GlobalMetric,
  Liquidation
} from "../generated/schema"
import {
  updateDailyMetricOnBorrow,
  updateDailyMetricOnRepay,
  updateDailyMetricOnLiquidate
} from "./daily-metrics"
import {
  getOrCreateUser,
  getOrCreatePosition
} from "./helpers"

const ZERO_BD = BigDecimal.fromString("0")
const ZERO_BI = BigInt.zero()

function createTransaction(
  position: Position,
  user: User,
  type: string,
  amount: BigInt,
  timestamp: BigInt,
  txHash: string,
  blockNumber: BigInt
): void {
  let txId = txHash + "-" + type + "-" + blockNumber.toString()
  let transaction = new Transaction(txId)

  transaction.position = position.id
  transaction.user = user.id
  transaction.type = type
  transaction.amount = amount
  transaction.timestamp = timestamp
  transaction.blockNumber = blockNumber
  transaction.txHash = Bytes.fromHexString(txHash)

  transaction.save()
}

export function handleBorrowed(event: Borrowed): void {
  let user = getOrCreateUser(event.params.user.toHexString().toLowerCase(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)

  // Check if this is the first borrow (new active position)
  let isNewActivePosition = position.borrowed.equals(ZERO_BI)

  // Update position
  position.borrowed = position.borrowed.plus(event.params.amount)
  position.status = "ACTIVE"
  position.healthFactor = BigDecimal.fromString(event.params.healthFactor.toString()).div(BigDecimal.fromString("100"))
  position.updatedAt = event.block.timestamp
  position.save()

  // Update user
  user.totalBorrowed = user.totalBorrowed.plus(event.params.amount)
  user.lifetimeBorrows = user.lifetimeBorrows.plus(event.params.amount)

  // FIX: Increment activePositions for new positions
  if (isNewActivePosition) {
    user.activePositions = user.activePositions + 1
  }

  user.updatedAt = event.block.timestamp
  user.save()

  // Create transaction
  createTransaction(
    position,
    user,
    "BORROW",
    event.params.amount,
    event.block.timestamp,
    event.transaction.hash.toHexString(),
    event.block.number
  )

  // Update global metrics
  let global = GlobalMetric.load("global")!
  global.totalVolumeBorrowed = global.totalVolumeBorrowed.plus(event.params.amount)
  global.currentBorrowed = global.currentBorrowed.plus(event.params.amount)
  if (global.currentBorrowed.gt(global.allTimeHighBorrowed)) {
    global.allTimeHighBorrowed = global.currentBorrowed
  }
  global.updatedAt = event.block.timestamp
  global.save()

  // Update daily metrics
  updateDailyMetricOnBorrow(
    event.block.timestamp,
    event.params.amount,
    user.id
  )
}

export function handleRepaid(event: Repaid): void {
  let user = getOrCreateUser(event.params.user.toHexString().toLowerCase(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)

  // Update position
  position.borrowed = event.params.remainingDebt
  position.updatedAt = event.block.timestamp

  if (event.params.remainingDebt.equals(ZERO_BI)) {
    position.status = "REPAID"
    position.closedAt = event.block.timestamp

    // Update active positions count
    let global = GlobalMetric.load("global")!
    if (global.activePositions > 0) {
      global.activePositions = global.activePositions - 1
    }
    global.save()

    // FIX: Decrement user's activePositions when position is closed
    if (user.activePositions > 0) {
      user.activePositions = user.activePositions - 1
    }
  }

  position.save()

  // Update user
  user.totalBorrowed = event.params.remainingDebt
  user.lifetimeRepayments = user.lifetimeRepayments.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()

  // Create transaction
  createTransaction(
    position,
    user,
    "REPAY",
    event.params.amount,
    event.block.timestamp,
    event.transaction.hash.toHexString(),
    event.block.number
  )

  // Update global metrics
  let global = GlobalMetric.load("global")!
  global.totalVolumeRepaid = global.totalVolumeRepaid.plus(event.params.amount)
  global.currentBorrowed = global.currentBorrowed.minus(event.params.amount)
  global.updatedAt = event.block.timestamp
  global.save()

  // Update daily metrics
  updateDailyMetricOnRepay(
    event.block.timestamp,
    event.params.amount,
    user.id
  )
}

export function handleLiquidated(event: Liquidated): void {
  // WORKAROUND: LendingPool.sol:201 emits Liquidated(liquidator, user) instead of (user, liquidator)
  // So we swap the params here to match the intended event signature
  let liquidatedUser = getOrCreateUser(event.params.liquidator.toHexString().toLowerCase(), event.block.timestamp)
  let position = getOrCreatePosition(liquidatedUser.id, event.block.timestamp)

  // Update position
  position.status = "LIQUIDATED"
  position.closedAt = event.block.timestamp
  position.borrowed = ZERO_BI
  position.totalCollateralUSD = ZERO_BI
  position.updatedAt = event.block.timestamp
  position.save()

  // Update user
  liquidatedUser.totalBorrowed = ZERO_BI
  liquidatedUser.totalCollateralUSD = ZERO_BI
  liquidatedUser.liquidationCount = liquidatedUser.liquidationCount + 1

  // FIX: Decrement user's activePositions when liquidated
  if (liquidatedUser.activePositions > 0) {
    liquidatedUser.activePositions = liquidatedUser.activePositions - 1
  }

  liquidatedUser.updatedAt = event.block.timestamp
  liquidatedUser.save()

  // Create liquidation record
  let liquidationId = event.transaction.hash.toHexString() + "-" + event.block.number.toString()
  let liquidation = new Liquidation(liquidationId)
  liquidation.position = position.id
  liquidation.user = liquidatedUser.id
  liquidation.liquidator = event.params.user
  liquidation.debtRepaid = event.params.debtRepaid
  liquidation.collateralSeizedUSD = event.params.collateralSeized  // Now in USD
  liquidation.timestamp = event.block.timestamp
  liquidation.blockNumber = event.block.number
  liquidation.txHash = event.transaction.hash
  liquidation.healthFactorBefore = BigDecimal.fromString("0.99")  // Below 1.0
  liquidation.save()

  // Create transaction
  createTransaction(
    position,
    liquidatedUser,
    "LIQUIDATION",
    event.params.debtRepaid,
    event.block.timestamp,
    event.transaction.hash.toHexString(),
    event.block.number
  )

  // Update global metrics
  let global = GlobalMetric.load("global")!
  global.totalLiquidations = global.totalLiquidations + 1
  if (global.activePositions > 0) {
    global.activePositions = global.activePositions - 1
  }
  global.currentBorrowed = global.currentBorrowed.minus(event.params.debtRepaid)
  global.updatedAt = event.block.timestamp
  global.save()

  // Update daily metrics (params swapped due to contract bug)
  updateDailyMetricOnLiquidate(
    event.block.timestamp,
    event.params.debtRepaid,
    liquidatedUser.id,
    event.params.user.toHexString().toLowerCase()  // This is actually the liquidator
  )
}