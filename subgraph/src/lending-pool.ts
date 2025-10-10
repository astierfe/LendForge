// subgraph/src/lending-pool.ts - v2.1 - Fix status transitions
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  CollateralDeposited,
  Borrowed,
  Repaid,
  CollateralWithdrawn,
  Liquidated
} from "../generated/LendingPoolV2/LendingPoolV2"
import {
  User,
  Position,
  Transaction,
  DailyMetric,
  GlobalMetric,
  Liquidation
} from "../generated/schema"

const LIQUIDATION_THRESHOLD = BigDecimal.fromString("0.83")
const ZERO_BD = BigDecimal.fromString("0")

function getOrCreateUser(address: string, timestamp: BigInt): User {
  let user = User.load(address)
  
  if (!user) {
    user = new User(address)
    user.totalCollateral = BigInt.zero()
    user.totalBorrowed = BigInt.zero()
    user.activePositions = 0
    user.lifetimeDeposits = BigInt.zero()
    user.lifetimeBorrows = BigInt.zero()
    user.lifetimeRepayments = BigInt.zero()
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
    position.collateral = BigInt.zero()
    position.borrowed = BigInt.zero()
    position.collateralRatio = BigInt.zero()
    position.healthFactor = BigDecimal.fromString("999999")
    position.status = "ACTIVE"
    position.createdAt = timestamp
    position.updatedAt = timestamp
    position.save()
    
    updateGlobalMetric(timestamp, "newPosition")
  }
  
  return position
}

function calculateHealthFactor(collateral: BigInt, borrowed: BigInt): BigDecimal {
  if (borrowed.equals(BigInt.zero())) {
    return BigDecimal.fromString("999999")
  }
  
  let collateralBD = collateral.toBigDecimal()
  let borrowedBD = borrowed.toBigDecimal()
  
  let adjustedCollateral = collateralBD.times(LIQUIDATION_THRESHOLD)
  let healthFactor = adjustedCollateral.div(borrowedBD).times(BigDecimal.fromString("100"))
  
  return healthFactor
}

function updateDailyMetric(timestamp: BigInt, type: string, amount: BigInt): void {
  let dayID = timestamp.toI32() / 86400
  let id = dayID.toString()
  
  let metric = DailyMetric.load(id)
  if (!metric) {
    metric = new DailyMetric(id)
    metric.date = dayID
    metric.tvl = BigInt.zero()
    metric.totalBorrowed = BigInt.zero()
    metric.utilizationRate = ZERO_BD
    metric.activeUsers = 0
    metric.activePositions = 0
    metric.depositsCount = 0
    metric.borrowsCount = 0
    metric.repaymentsCount = 0
    metric.liquidationsCount = 0
    metric.volumeDeposited = BigInt.zero()
    metric.volumeBorrowed = BigInt.zero()
    metric.volumeRepaid = BigInt.zero()
  }
  
  if (type == "deposit") {
    metric.depositsCount = metric.depositsCount + 1
    metric.volumeDeposited = metric.volumeDeposited.plus(amount)
  } else if (type == "borrow") {
    metric.borrowsCount = metric.borrowsCount + 1
    metric.volumeBorrowed = metric.volumeBorrowed.plus(amount)
  } else if (type == "repay") {
    metric.repaymentsCount = metric.repaymentsCount + 1
    metric.volumeRepaid = metric.volumeRepaid.plus(amount)
  } else if (type == "liquidation") {
    metric.liquidationsCount = metric.liquidationsCount + 1
  }
  
  let global = getOrCreateGlobalMetric()
  metric.tvl = global.currentTVL
  metric.totalBorrowed = global.currentBorrowed
  
  if (!metric.tvl.equals(BigInt.zero())) {
    let tvlBD = metric.tvl.toBigDecimal()
    let borrowedBD = metric.totalBorrowed.toBigDecimal()
    metric.utilizationRate = borrowedBD.div(tvlBD)
  }
  
  metric.save()
}

function getOrCreateGlobalMetric(): GlobalMetric {
  let id = "global"
  let metric = GlobalMetric.load(id)
  
  if (!metric) {
    metric = new GlobalMetric(id)
    metric.totalUsers = 0
    metric.totalPositions = 0
    metric.activePositions = 0
    metric.totalVolumeDeposited = BigInt.zero()
    metric.totalVolumeBorrowed = BigInt.zero()
    metric.totalVolumeRepaid = BigInt.zero()
    metric.totalLiquidations = 0
    metric.currentTVL = BigInt.zero()
    metric.currentBorrowed = BigInt.zero()
    metric.allTimeHighTVL = BigInt.zero()
    metric.allTimeHighBorrowed = BigInt.zero()
    metric.updatedAt = BigInt.zero()
  }
  
  return metric
}

function updateGlobalMetric(timestamp: BigInt, action: string): void {
  let metric = getOrCreateGlobalMetric()
  
  if (action == "newUser") {
    metric.totalUsers = metric.totalUsers + 1
  } else if (action == "newPosition") {
    metric.totalPositions = metric.totalPositions + 1
    metric.activePositions = metric.activePositions + 1
  } else if (action == "closePosition") {
    metric.activePositions = metric.activePositions - 1
  } else if (action == "reactivatePosition") {
    metric.activePositions = metric.activePositions + 1
  }
  
  metric.updatedAt = timestamp
  metric.save()
}

export function handleCollateralDeposited(event: CollateralDeposited): void {
  let user = getOrCreateUser(event.params.user.toHex(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)
  
  // FIX: Force ACTIVE si collateral ajouté
  let wasRepaid = position.status == "REPAID"
  
  position.collateral = position.collateral.plus(event.params.amount)
  position.updatedAt = event.block.timestamp
  position.status = "ACTIVE"
  
  // FIX: Ne pas recalculer HF ici (prix oracle inconnu)
  // Le bot lira HF on-chain directement
  // Garder dernier HF connu ou placeholder si aucun borrow
  if (position.borrowed.equals(BigInt.zero())) {
    position.healthFactor = BigDecimal.fromString("999999")
    position.collateralRatio = BigInt.zero()
  }
  // Si borrowed > 0, garder HF précédent (sera mis à jour au prochain borrow/repay)
  
  position.save()
  
  // Reactiver compteur si position était fermée
  if (wasRepaid) {
    updateGlobalMetric(event.block.timestamp, "reactivatePosition")
  }
  
  user.totalCollateral = user.totalCollateral.plus(event.params.amount)
  user.lifetimeDeposits = user.lifetimeDeposits.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  let txId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let tx = new Transaction(txId)
  tx.position = position.id
  tx.user = user.id
  tx.type = "DEPOSIT"
  tx.amount = event.params.amount
  tx.timestamp = event.block.timestamp
  tx.blockNumber = event.block.number
  tx.txHash = event.transaction.hash
  tx.gasUsed = event.transaction.gasLimit
  tx.save()
  
  let global = getOrCreateGlobalMetric()
  global.currentTVL = global.currentTVL.plus(event.params.amount)
  global.totalVolumeDeposited = global.totalVolumeDeposited.plus(event.params.amount)
  
  if (global.currentTVL.gt(global.allTimeHighTVL)) {
    global.allTimeHighTVL = global.currentTVL
  }
  
  global.updatedAt = event.block.timestamp
  global.save()
  
  updateDailyMetric(event.block.timestamp, "deposit", event.params.amount)
}

export function handleBorrowed(event: Borrowed): void {
  let user = getOrCreateUser(event.params.user.toHex(), event.block.timestamp)
  let position = getOrCreatePosition(user.id, event.block.timestamp)
  
  // FIX: Force ACTIVE si dette ajoutée
  let wasRepaid = position.status == "REPAID"
  
  position.borrowed = position.borrowed.plus(event.params.amount)
  
  // FIX: Utiliser healthFactor de l'event au lieu de le calculer
  position.healthFactor = BigDecimal.fromString(event.params.healthFactor.toString()).div(BigDecimal.fromString("100"))
  position.status = "ACTIVE"
  
  if (!position.borrowed.equals(BigInt.zero())) {
    position.collateralRatio = position.collateral.times(BigInt.fromI32(100)).div(position.borrowed)
  }
  
  position.updatedAt = event.block.timestamp
  position.save()
  
  // Reactiver compteur si position était fermée
  if (wasRepaid) {
    updateGlobalMetric(event.block.timestamp, "reactivatePosition")
  }
  
  user.totalBorrowed = user.totalBorrowed.plus(event.params.amount)
  user.lifetimeBorrows = user.lifetimeBorrows.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  let txId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let tx = new Transaction(txId)
  tx.position = position.id
  tx.user = user.id
  tx.type = "BORROW"
  tx.amount = event.params.amount
  tx.timestamp = event.block.timestamp
  tx.blockNumber = event.block.number
  tx.txHash = event.transaction.hash
  tx.gasUsed = event.transaction.gasLimit
  tx.save()
  
  let global = getOrCreateGlobalMetric()
  global.currentBorrowed = global.currentBorrowed.plus(event.params.amount)
  global.totalVolumeBorrowed = global.totalVolumeBorrowed.plus(event.params.amount)
  
  if (global.currentBorrowed.gt(global.allTimeHighBorrowed)) {
    global.allTimeHighBorrowed = global.currentBorrowed
  }
  
  global.updatedAt = event.block.timestamp
  global.save()
  
  updateDailyMetric(event.block.timestamp, "borrow", event.params.amount)
}

export function handleRepaid(event: Repaid): void {
  let user = User.load(event.params.user.toHex())
  if (!user) return
  
  let position = Position.load(user.id)
  if (!position) return
  
  position.borrowed = position.borrowed.minus(event.params.amount)
  
  // FIX: Déterminer status basé sur collateral ET borrowed
  if (position.borrowed.equals(BigInt.zero())) {
    position.healthFactor = BigDecimal.fromString("999999")
    position.collateralRatio = BigInt.zero()
    
    // Position fermée seulement si debt=0 ET collateral=0
    if (position.collateral.equals(BigInt.zero())) {
      position.status = "REPAID"
      position.closedAt = event.block.timestamp
      updateGlobalMetric(event.block.timestamp, "closePosition")
    } else {
      // Collateral reste, position ACTIVE
      position.status = "ACTIVE"
    }
  } else {
    // Debt existe, position forcément ACTIVE
    // Ne pas recalculer HF sans prix réel
    // Garder HF précédent, bot lira on-chain
    position.status = "ACTIVE"
  }
  
  position.updatedAt = event.block.timestamp
  position.save()
  
  user.totalBorrowed = user.totalBorrowed.minus(event.params.amount)
  user.lifetimeRepayments = user.lifetimeRepayments.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  let txId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let tx = new Transaction(txId)
  tx.position = position.id
  tx.user = user.id
  tx.type = "REPAY"
  tx.amount = event.params.amount
  tx.timestamp = event.block.timestamp
  tx.blockNumber = event.block.number
  tx.txHash = event.transaction.hash
  tx.gasUsed = event.transaction.gasLimit
  tx.save()
  
  let global = getOrCreateGlobalMetric()
  global.currentBorrowed = global.currentBorrowed.minus(event.params.amount)
  global.totalVolumeRepaid = global.totalVolumeRepaid.plus(event.params.amount)
  global.updatedAt = event.block.timestamp
  global.save()
  
  updateDailyMetric(event.block.timestamp, "repay", event.params.amount)
}

export function handleCollateralWithdrawn(event: CollateralWithdrawn): void {
  let user = User.load(event.params.user.toHex())
  if (!user) return
  
  let position = Position.load(user.id)
  if (!position) return
  
  position.collateral = position.collateral.minus(event.params.amount)
  
  // FIX: Déterminer status basé sur collateral ET borrowed
  // Ne pas recalculer HF (bot le fera on-chain)
  if (!position.borrowed.equals(BigInt.zero())) {
    position.status = "ACTIVE"
    // Garder HF précédent, sera mis à jour au prochain borrow/repay
  } else if (position.collateral.equals(BigInt.zero())) {
    // Ni collateral ni dette, position fermée
    position.status = "REPAID"
    position.healthFactor = BigDecimal.fromString("999999")
    position.closedAt = event.block.timestamp
    updateGlobalMetric(event.block.timestamp, "closePosition")
  } else {
    // Collateral reste mais pas de dette, reste ACTIVE
    position.status = "ACTIVE"
    position.healthFactor = BigDecimal.fromString("999999")
  }
  
  position.updatedAt = event.block.timestamp
  position.save()
  
  user.totalCollateral = user.totalCollateral.minus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
  
  let txId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let tx = new Transaction(txId)
  tx.position = position.id
  tx.user = user.id
  tx.type = "WITHDRAW"
  tx.amount = event.params.amount
  tx.timestamp = event.block.timestamp
  tx.blockNumber = event.block.number
  tx.txHash = event.transaction.hash
  tx.gasUsed = event.transaction.gasLimit
  tx.save()
  
  let global = getOrCreateGlobalMetric()
  global.currentTVL = global.currentTVL.minus(event.params.amount)
  global.updatedAt = event.block.timestamp
  global.save()
}

export function handleLiquidated(event: Liquidated): void {
  let user = User.load(event.params.user.toHex())
  if (!user) return
  
  let position = Position.load(user.id)
  if (!position) return
  
  let healthFactorBefore = position.healthFactor
  
  position.borrowed = BigInt.zero()
  position.collateral = position.collateral.minus(event.params.collateralSeized)
  position.healthFactor = BigDecimal.fromString("999999")
  position.collateralRatio = BigInt.zero()
  position.status = "LIQUIDATED"
  position.closedAt = event.block.timestamp
  position.updatedAt = event.block.timestamp
  position.save()
  
  user.totalBorrowed = user.totalBorrowed.minus(event.params.debtRepaid)
  user.totalCollateral = user.totalCollateral.minus(event.params.collateralSeized)
  user.liquidationCount = user.liquidationCount + 1
  user.updatedAt = event.block.timestamp
  user.save()
  
  let txId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let tx = new Transaction(txId)
  tx.position = position.id
  tx.user = user.id
  tx.type = "LIQUIDATION"
  tx.amount = event.params.debtRepaid
  tx.timestamp = event.block.timestamp
  tx.blockNumber = event.block.number
  tx.txHash = event.transaction.hash
  tx.gasUsed = event.transaction.gasLimit
  tx.save()
  
  let liquidation = new Liquidation(txId)
  liquidation.position = position.id
  liquidation.user = user.id
  liquidation.liquidator = event.params.liquidator
  liquidation.debtCleared = event.params.debtRepaid
  liquidation.collateralSeized = event.params.collateralSeized
  liquidation.timestamp = event.block.timestamp
  liquidation.blockNumber = event.block.number
  liquidation.txHash = event.transaction.hash
  liquidation.healthFactorBefore = healthFactorBefore
  liquidation.save()
  
  let global = getOrCreateGlobalMetric()
  global.currentTVL = global.currentTVL.minus(event.params.collateralSeized)
  global.currentBorrowed = global.currentBorrowed.minus(event.params.debtRepaid)
  global.totalLiquidations = global.totalLiquidations + 1
  global.updatedAt = event.block.timestamp
  global.save()
  
  updateGlobalMetric(event.block.timestamp, "closePosition")
  updateDailyMetric(event.block.timestamp, "liquidation", event.params.debtRepaid)
}