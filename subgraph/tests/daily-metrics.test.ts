import {
  describe,
  test,
  assert,
  clearStore,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  getDailyMetricId,
  getOrCreateDailyMetric,
  calculateUtilizationRate,
  updateDailyMetricOnDeposit
} from "../src/daily-metrics"
import { GlobalMetric } from "../generated/schema"

const TIMESTAMP = BigInt.fromI32(1730000000)
const EXPECTED_DAY_ID = "daily-20023"

describe("DailyMetric Tests", () => {
  beforeEach(() => {
    clearStore()
  })

  afterEach(() => {
    clearStore()
  })

  test("getDailyMetricId returns correct format", () => {
    let id = getDailyMetricId(TIMESTAMP)
    assert.stringEquals(id, EXPECTED_DAY_ID)
  })

  test("getOrCreateDailyMetric initializes all fields", () => {
    let metric = getOrCreateDailyMetric(TIMESTAMP)

    assert.stringEquals(metric.id, EXPECTED_DAY_ID)
    assert.bigIntEquals(metric.totalTVL, BigInt.zero())
    assert.bigIntEquals(metric.totalBorrowed, BigInt.zero())
    assert.i32Equals(metric.depositsCount, 0)
    assert.i32Equals(metric.borrowsCount, 0)
    assert.i32Equals(metric.activeUsers, 0)
  })

  test("getOrCreateDailyMetric loads existing metric", () => {
    let metric1 = getOrCreateDailyMetric(TIMESTAMP)
    metric1.depositsCount = 5
    metric1.save()

    let metric2 = getOrCreateDailyMetric(TIMESTAMP)
    assert.i32Equals(metric2.depositsCount, 5)
  })

  test("calculateUtilizationRate returns 0 when TVL is 0", () => {
    let rate = calculateUtilizationRate(BigInt.fromI32(100), BigInt.zero())
    assert.stringEquals(rate.toString(), "0")
  })

  test("calculateUtilizationRate calculates correctly", () => {
    let borrowed = BigInt.fromI32(50)
    let tvl = BigInt.fromI32(100)
    let rate = calculateUtilizationRate(borrowed, tvl)

    assert.stringEquals(rate.toString(), "50")
  })

  test("updateDailyMetricOnDeposit increments counters", () => {
    let global = new GlobalMetric("global")
    global.totalUsers = 0
    global.totalPositions = 0
    global.activePositions = 0
    global.totalVolumeDeposited = BigInt.zero()
    global.totalVolumeBorrowed = BigInt.zero()
    global.totalVolumeRepaid = BigInt.zero()
    global.totalLiquidations = 0
    global.currentTVL = BigInt.fromI32(1000)
    global.currentBorrowed = BigInt.fromI32(500)
    global.allTimeHighTVL = BigInt.zero()
    global.allTimeHighBorrowed = BigInt.zero()
    global.totalETHDeposited = BigInt.fromI32(1000)
    global.totalUSDCDeposited = BigInt.zero()
    global.totalDAIDeposited = BigInt.zero()
    global.updatedAt = TIMESTAMP
    global.save()

    let ethAddress = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let userAddress = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"
    let amount = BigInt.fromI32(100)

    updateDailyMetricOnDeposit(TIMESTAMP, amount, ethAddress, userAddress)

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeDeposited", "100")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "totalTVL", "1000")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "ethTVL", "1000")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "utilizationRate", "50")
  })

  test("updateDailyMetricOnDeposit handles missing GlobalMetric gracefully", () => {
    let ethAddress = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let userAddress = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"
    let amount = BigInt.fromI32(100)

    updateDailyMetricOnDeposit(TIMESTAMP, amount, ethAddress, userAddress)

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeDeposited", "100")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "totalTVL", "0")
  })

  test("trackUniqueUser: same user twice in same day = activeUsers stays 1", () => {
    let ethAddress = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let userAddress = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"

    updateDailyMetricOnDeposit(TIMESTAMP, BigInt.fromI32(100), ethAddress, userAddress)
    updateDailyMetricOnDeposit(TIMESTAMP, BigInt.fromI32(200), ethAddress, userAddress)

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "2")

    let activityId = "daily-20023-" + userAddress
    assert.fieldEquals("DailyUserActivity", activityId, "transactionCount", "2")
  })

  test("trackUniqueUser: two different users = activeUsers = 2", () => {
    let ethAddress = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let user1 = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"
    let user2 = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"

    updateDailyMetricOnDeposit(TIMESTAMP, BigInt.fromI32(100), ethAddress, user1)
    updateDailyMetricOnDeposit(TIMESTAMP, BigInt.fromI32(200), ethAddress, user2)

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "2")
    assert.entityCount("DailyUserActivity", 2)
  })

  test("trackUniqueUser: same user on different days = 2 separate activities", () => {
    let ethAddress = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let userAddress = "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01"
    let day2Timestamp = TIMESTAMP.plus(BigInt.fromI32(86400))

    updateDailyMetricOnDeposit(TIMESTAMP, BigInt.fromI32(100), ethAddress, userAddress)
    updateDailyMetricOnDeposit(day2Timestamp, BigInt.fromI32(200), ethAddress, userAddress)

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
    assert.fieldEquals("DailyMetric", "daily-20024", "activeUsers", "1")
    assert.entityCount("DailyUserActivity", 2)
  })
})
