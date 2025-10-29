import {
  describe,
  test,
  assert,
  clearStore,
  beforeEach,
  afterEach,
  createMockedFunction
} from "matchstick-as/assembly/index"
import { BigInt, Address, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { handleCollateralDeposited } from "../src/collateral-manager"
import { createCollateralDepositedEvent } from "./utils"
import { GlobalMetric } from "../generated/schema"

const USER_ADDRESS = Address.fromString("0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01")
const ETH_ADDRESS = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
const COLLATERAL_MANAGER_ADDRESS = Address.fromString("0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758")
const AMOUNT = BigInt.fromI32(1000)
const TIMESTAMP = BigInt.fromI32(1730000000)
const EXPECTED_DAY_ID = "daily-20023"

function mockGetCollateralValueUSD(userAddress: Address, valueUSD: BigInt): void {
  createMockedFunction(
    COLLATERAL_MANAGER_ADDRESS,
    "getCollateralValueUSD",
    "getCollateralValueUSD(address):(uint256)"
  )
    .withArgs([ethereum.Value.fromAddress(userAddress)])
    .returns([ethereum.Value.fromUnsignedBigInt(valueUSD)])
}

describe("CollateralManager Integration Tests", () => {
  beforeEach(() => {
    clearStore()
  })

  afterEach(() => {
    clearStore()
  })

  test("ETH address comparison works", () => {
    let ethFromEvent = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    let ethConstant = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")

    // Ce test doit passer
    assert.assertTrue(ethFromEvent.equals(ethConstant))
  })

  test("DEBUG: Event asset address format", () => {
    let event = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      BigInt.fromI32(1000),
      BigInt.fromI32(1000)
    )

    // Vérifier que l'adresse dans l'event est bien celle attendue
    let ethConstant = Bytes.fromHexString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
    assert.assertTrue(event.params.asset.equals(ethConstant))
  })

  test("handleCollateralDeposited creates DailyMetric", () => {
    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(2000))

    let event = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      AMOUNT,
      BigInt.fromI32(2000)
    )
    event.block.timestamp = TIMESTAMP
    event.address = COLLATERAL_MANAGER_ADDRESS

    handleCollateralDeposited(event)

    assert.entityCount("DailyMetric", 1)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeDeposited", "1000")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
  })

  test("handleCollateralDeposited increments existing DailyMetric", () => {
    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(2000))
    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(2500))

    let event1 = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      AMOUNT,
      BigInt.fromI32(2000)
    )
    event1.block.timestamp = TIMESTAMP
    event1.address = COLLATERAL_MANAGER_ADDRESS

    let event2 = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      BigInt.fromI32(500),
      BigInt.fromI32(2500)
    )
    event2.block.timestamp = TIMESTAMP
    event2.address = COLLATERAL_MANAGER_ADDRESS

    handleCollateralDeposited(event1)
    handleCollateralDeposited(event2)

    assert.entityCount("DailyMetric", 1)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "2")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeDeposited", "1500")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
  })

  test("handleCollateralDeposited creates separate metrics for different days", () => {
    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(2000))
    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(2000))

    let event1 = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      AMOUNT,
      BigInt.fromI32(2000)
    )
    event1.block.timestamp = TIMESTAMP
    event1.address = COLLATERAL_MANAGER_ADDRESS

    let event2 = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      AMOUNT,
      BigInt.fromI32(2000)
    )
    event2.block.timestamp = TIMESTAMP.plus(BigInt.fromI32(86400))
    event2.address = COLLATERAL_MANAGER_ADDRESS

    handleCollateralDeposited(event1)
    handleCollateralDeposited(event2)

    assert.entityCount("DailyMetric", 2)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "1")
    assert.fieldEquals("DailyMetric", "daily-20024", "depositsCount", "1")
  })

  test("INTEGRATION: handleCollateralDeposited updates GlobalMetric and DailyMetric TVL", () => {
    let global = new GlobalMetric("global")
    global.totalUsers = 0
    global.totalPositions = 0
    global.activePositions = 0
    global.totalVolumeDeposited = BigInt.zero()
    global.totalVolumeBorrowed = BigInt.zero()
    global.totalVolumeRepaid = BigInt.zero()
    global.totalLiquidations = 0
    global.currentTVL = BigInt.zero()
    global.currentBorrowed = BigInt.zero()
    global.allTimeHighTVL = BigInt.zero()
    global.allTimeHighBorrowed = BigInt.zero()
    global.totalETHDeposited = BigInt.zero()
    global.totalUSDCDeposited = BigInt.zero()
    global.totalDAIDeposited = BigInt.zero()
    global.updatedAt = TIMESTAMP
    global.save()

    mockGetCollateralValueUSD(USER_ADDRESS, BigInt.fromI32(1000))

    let event = createCollateralDepositedEvent(
      USER_ADDRESS,
      ETH_ADDRESS,
      BigInt.fromI32(1000),
      BigInt.fromI32(1000)
    )
    event.block.timestamp = TIMESTAMP
    event.address = COLLATERAL_MANAGER_ADDRESS

    handleCollateralDeposited(event)

    assert.fieldEquals("GlobalMetric", "global", "totalETHDeposited", "1000")
    assert.fieldEquals("GlobalMetric", "global", "currentTVL", "1000")
    assert.fieldEquals("GlobalMetric", "global", "totalVolumeDeposited", "1000")

    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "ethTVL", "1000")    
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "totalTVL", "1000")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "depositsCount", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeDeposited", "1000")
  })
})
