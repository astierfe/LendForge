// subgraph/src/helpers.ts - v3.0 - Shared helper functions
// Centralized functions to prevent data inconsistencies between datasources

import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  User,
  Position,
  GlobalMetric
} from "../generated/schema"

const ZERO_BI = BigInt.zero()

/**
 * Get or create a User entity
 * IMPORTANT: This is the SINGLE source of truth for User creation
 * Used by both LendingPool and CollateralManager datasources
 *
 * @param address - User address (must be lowercase)
 * @param timestamp - Block timestamp
 * @returns User entity
 */
export function getOrCreateUser(address: string, timestamp: BigInt): User {
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

    // Update global user count
    updateGlobalMetric(timestamp, "newUser")
  }

  return user
}

/**
 * Get or create a Position entity
 * One position per user (MVP limitation)
 *
 * @param userId - User address (position ID = user ID)
 * @param timestamp - Block timestamp
 * @returns Position entity
 */
export function getOrCreatePosition(userId: string, timestamp: BigInt): Position {
  let positionId = userId
  let position = Position.load(positionId)

  if (!position) {
    position = new Position(positionId)
    position.user = userId
    position.totalCollateralUSD = ZERO_BI
    position.borrowed = ZERO_BI
    position.healthFactor = BigDecimal.fromString("999.99")
    position.status = "INACTIVE"  // FIX ANO_009: Start INACTIVE, becomes ACTIVE only when borrowed > 0
    position.createdAt = timestamp
    position.updatedAt = timestamp
    position.save()

    // Update global position count
    updateGlobalMetric(timestamp, "newPosition")
  }

  return position
}

/**
 * Update global metrics
 * Centralizes counter updates for users and positions
 *
 * @param timestamp - Block timestamp
 * @param action - Type of update ("newUser", "newPosition")
 */
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
