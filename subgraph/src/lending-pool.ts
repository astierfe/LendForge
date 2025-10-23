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

const ZERO_BD = BigDecimal.fromString("0")
const ZERO_BI = BigInt.zero()

function getOrCreateUser(address: string, timestamp: BigInt): User {
  let user = User.load(address)

  if (!user) {
    user = new User(address)
    user.totalCollateralUSD = ZERO_BI
    user.totalBorrowed = ZERO_BI
    user.activePositions = 0
    user.lifetimeDeposits = ZERO_BI
    user.lifetimeBorrows = ZERO_BI
    user.lifetimeRepayments = ZERO_BI
    user.liquidationCount = 0
    user.createdAt = timestamp
    user.updatedAt = timestamp
    user.save()

    updateGlobalMetric(timestamp, "newUser")
  }

  return user
}

function getOrCreatePosition(userId: string, timestamp: BigInt): Position {
  let positionId = userId
  let position = Position.load(positionId)

  if (!position) {
    position = new Position(positionId)
    position.user = userId
    position.totalCollateralUSD = ZERO_BI
    position.borrowed = ZERO_BI
    position.healthFactor = BigDecimal.fromString("999.99")
    position.status = "ACTIVE"
    position.createdAt = timestamp
    position.updatedAt = timestamp
    position.save()

    updateGlobalMetric(timestamp, "newPosition")
  }

  return position
}

function updateGlobalMetric(timestamp: BigInt, action: string): void {
  let globalId = "global"
  let global = GlobalMetric.load(globalId)

  if (!global) {
    global = new GlobalMetric(globalId)
    global.totalUsers = 0
    global.totalPositions = 0
    global.activePositions = 0
    global.totalVolumeDeposited = ZERO_BI
    global.totalVolumeBorrowed = ZERO_BI
    global.totalVolumeRepaid = ZERO_BI
    global.totalLiquidations = 0
    global.currentTVL = ZERO_BI
    global.currentBorrowed = ZERO_BI
    global.allTimeHighTVL = ZERO_BI
    global.allTimeHighBorrowed = ZERO_BI
    global.totalETHDeposited = ZERO_BI
    global.totalUSDCDeposited = ZERO_BI
    global.totalDAIDeposited = ZERO_BI
  }

  if (action == "newUser") {
    global.totalUsers = global.totalUsers + 1
  } else if (action == "newPosition") {
    global.totalPositions = global.totalPositions + 1
    global.activePositions = global.activePositions + 1
  }

  global.updatedAt = timestamp
  global.save()
}

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
  let user = getOrCreateUser(event.params.user.toHexString(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)

  // Update position
  position.borrowed = position.borrowed.plus(event.params.amount)
  position.healthFactor = BigDecimal.fromString(event.params.healthFactor.toString()).div(BigDecimal.fromString("100"))
  position.updatedAt = event.block.timestamp
  position.save()

  // Update user
  user.totalBorrowed = user.totalBorrowed.plus(event.params.amount)
  user.lifetimeBorrows = user.lifetimeBorrows.plus(event.params.amount)
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
}

export function handleRepaid(event: Repaid): void {
  let user = getOrCreateUser(event.params.user.toHexString(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)

  // Update position
  position.borrowed = event.params.remainingDebt
  position.updatedAt = event.block.timestamp

  if (event.params.remainingDebt.equals(ZERO_BI)) {
    position.status = "REPAID"
    position.closedAt = event.block.timestamp

    // Update active positions count
    let global = GlobalMetric.load("global")!
    global.activePositions = global.activePositions - 1
    global.save()
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
}

export function handleLiquidated(event: Liquidated): void {
  let user = getOrCreateUser(event.params.user.toHexString(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)

  // Update position
  position.status = "LIQUIDATED"
  position.closedAt = event.block.timestamp
  position.borrowed = ZERO_BI
  position.totalCollateralUSD = ZERO_BI
  position.updatedAt = event.block.timestamp
  position.save()

  // Update user
  user.totalBorrowed = ZERO_BI
  user.totalCollateralUSD = ZERO_BI
  user.liquidationCount = user.liquidationCount + 1
  user.updatedAt = event.block.timestamp
  user.save()

  // Create liquidation record
  let liquidationId = event.transaction.hash.toHexString() + "-" + event.block.number.toString()
  let liquidation = new Liquidation(liquidationId)
  liquidation.position = position.id
  liquidation.user = user.id
  liquidation.liquidator = event.params.liquidator
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
    user,
    "LIQUIDATION",
    event.params.debtRepaid,
    event.block.timestamp,
    event.transaction.hash.toHexString(),
    event.block.number
  )

  // Update global metrics
  let global = GlobalMetric.load("global")!
  global.totalLiquidations = global.totalLiquidations + 1
  global.activePositions = global.activePositions - 1
  global.currentBorrowed = global.currentBorrowed.minus(event.params.debtRepaid)
  global.updatedAt = event.block.timestamp
  global.save()
}