// subgraph/src/daily-metrics.ts - DailyMetric helpers (defensive version)
import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { DailyMetric, GlobalMetric, DailyUserActivity } from "../generated/schema"

const ZERO_BI = BigInt.zero()
const ZERO_BD = BigDecimal.fromString("0")
const SECONDS_PER_DAY = BigInt.fromI32(86400)

const ETH_ADDRESS = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
const USDC_ADDRESS = Bytes.fromHexString("0xc47095ad18c67fba7e46d56bdbb014901f3e327b")
const DAI_ADDRESS = Bytes.fromHexString("0x2fa332e8337642891885453fd40a7a7bb010b71a")

export function getDailyMetricId(timestamp: BigInt): string {
  let dayId = timestamp.div(SECONDS_PER_DAY)
  return "daily-" + dayId.toString()
}

export function getOrCreateDailyMetric(timestamp: BigInt): DailyMetric {
  let id = getDailyMetricId(timestamp)
  let metric = DailyMetric.load(id)

  if (metric == null) {
    metric = new DailyMetric(id)

    let dayStartTimestamp = timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY)
    metric.date = dayStartTimestamp.toI32()

    metric.totalTVL = ZERO_BI
    metric.totalBorrowed = ZERO_BI
    metric.utilizationRate = ZERO_BD
    metric.activeUsers = 0
    metric.activePositions = 0

    metric.depositsCount = 0
    metric.borrowsCount = 0
    metric.repaymentsCount = 0
    metric.liquidationsCount = 0

    metric.volumeDeposited = ZERO_BI
    metric.volumeBorrowed = ZERO_BI
    metric.volumeRepaid = ZERO_BI

    metric.ethTVL = ZERO_BI
    metric.usdcTVL = ZERO_BI
    metric.daiTVL = ZERO_BI

    metric.save()
  }

  return metric
}

export function calculateUtilizationRate(totalBorrowed: BigInt, totalTVL: BigInt): BigDecimal {
  if (totalTVL.equals(ZERO_BI)) {
    return ZERO_BD
  }

  return totalBorrowed.toBigDecimal().div(totalTVL.toBigDecimal()).times(BigDecimal.fromString("100"))
}

function trackUniqueUser(timestamp: BigInt, userAddress: string, metricId: string): boolean {
  let dayId = timestamp.div(SECONDS_PER_DAY)
  let activityId = "daily-" + dayId.toString() + "-" + userAddress
  let activity = DailyUserActivity.load(activityId)

  if (activity == null) {
    activity = new DailyUserActivity(activityId)
    activity.dailyMetric = metricId
    activity.user = userAddress
    activity.date = timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY).toI32()
    activity.transactionCount = 1
    activity.save()
    return true
  } else {
    activity.transactionCount = activity.transactionCount + 1
    activity.save()
    return false
  }
}

function syncDailyMetricWithGlobal(metric: DailyMetric): void {
  let global = GlobalMetric.load("global")

  if (global == null) {
    return
  }

  metric.ethTVL = global.totalETHDeposited
  metric.usdcTVL = global.totalUSDCDeposited
  metric.daiTVL = global.totalDAIDeposited
  metric.totalTVL = global.currentTVL
  metric.totalBorrowed = global.currentBorrowed
  metric.activePositions = global.activePositions

  metric.utilizationRate = calculateUtilizationRate(metric.totalBorrowed, metric.totalTVL)

  metric.save()
}

export function updateDailyMetricOnDeposit(
  timestamp: BigInt,
  amount: BigInt,
  asset: Bytes,
  userAddress: string
): void {
  let metric = getOrCreateDailyMetric(timestamp)

  metric.depositsCount = metric.depositsCount + 1
  metric.volumeDeposited = metric.volumeDeposited.plus(amount)

  let isNewUser = trackUniqueUser(timestamp, userAddress, metric.id)
  if (isNewUser) {
    metric.activeUsers = metric.activeUsers + 1
  }

  metric.save()

  syncDailyMetricWithGlobal(metric)
}

export function updateDailyMetricOnWithdraw(
  timestamp: BigInt,
  amount: BigInt,
  asset: Bytes,
  userAddress: string
): void {
  let metric = getOrCreateDailyMetric(timestamp)

  let isNewUser = trackUniqueUser(timestamp, userAddress, metric.id)
  if (isNewUser) {
    metric.activeUsers = metric.activeUsers + 1
  }

  metric.save()

  syncDailyMetricWithGlobal(metric)
}

export function updateDailyMetricOnBorrow(
  timestamp: BigInt,
  amount: BigInt,
  userAddress: string
): void {
  let metric = getOrCreateDailyMetric(timestamp)

  metric.borrowsCount = metric.borrowsCount + 1
  metric.volumeBorrowed = metric.volumeBorrowed.plus(amount)

  let isNewUser = trackUniqueUser(timestamp, userAddress, metric.id)
  if (isNewUser) {
    metric.activeUsers = metric.activeUsers + 1
  }

  metric.save()

  syncDailyMetricWithGlobal(metric)
}

export function updateDailyMetricOnRepay(
  timestamp: BigInt,
  amount: BigInt,
  userAddress: string
): void {
  let metric = getOrCreateDailyMetric(timestamp)

  metric.repaymentsCount = metric.repaymentsCount + 1
  metric.volumeRepaid = metric.volumeRepaid.plus(amount)

  let isNewUser = trackUniqueUser(timestamp, userAddress, metric.id)
  if (isNewUser) {
    metric.activeUsers = metric.activeUsers + 1
  }

  metric.save()

  syncDailyMetricWithGlobal(metric)
}

export function updateDailyMetricOnLiquidate(
  timestamp: BigInt,
  debtRepaid: BigInt,
  userAddress: string,
  liquidatorAddress: string
): void {
  let metric = getOrCreateDailyMetric(timestamp)

  metric.liquidationsCount = metric.liquidationsCount + 1

  let isNewUser = trackUniqueUser(timestamp, userAddress, metric.id)
  if (isNewUser) {
    metric.activeUsers = metric.activeUsers + 1
  }

  let isNewLiquidator = trackUniqueUser(timestamp, liquidatorAddress, metric.id)
  if (isNewLiquidator) {
    metric.activeUsers = metric.activeUsers + 1
  }

  metric.save()

  syncDailyMetricWithGlobal(metric)
}
