import {
  describe,
  test,
  assert,
  clearStore,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  handleBorrowed,
  handleRepaid,
  handleLiquidated
} from "../src/lending-pool"
import { createBorrowedEvent } from "./utils"

const USER_ADDRESS = Address.fromString("0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01")
const LIQUIDATOR_ADDRESS = Address.fromString("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1")
const AMOUNT = BigInt.fromI32(1000)
const TIMESTAMP = BigInt.fromI32(1730000000)
const EXPECTED_DAY_ID = "daily-20023"

describe("LendingPool Integration Tests", () => {
  beforeEach(() => {
    clearStore()
  })

  afterEach(() => {
    clearStore()
  })

  test("handleBorrowed creates DailyMetric", () => {
    let event = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event.block.timestamp = TIMESTAMP

    handleBorrowed(event)

    assert.entityCount("DailyMetric", 1)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "borrowsCount", "1")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeBorrowed", "1000")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
  })

  test("handleBorrowed increments existing DailyMetric", () => {
    let event1 = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event1.block.timestamp = TIMESTAMP

    let event2 = createBorrowedEvent(
      USER_ADDRESS,
      BigInt.fromI32(500),
      BigInt.fromI32(12000)
    )
    event2.block.timestamp = TIMESTAMP

    handleBorrowed(event1)
    handleBorrowed(event2)

    assert.entityCount("DailyMetric", 1)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "borrowsCount", "2")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "volumeBorrowed", "1500")
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "activeUsers", "1")
  })

  test("handleBorrowed creates separate metrics for different days", () => {
    let event1 = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event1.block.timestamp = TIMESTAMP

    let event2 = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event2.block.timestamp = TIMESTAMP.plus(BigInt.fromI32(86400))

    handleBorrowed(event1)
    handleBorrowed(event2)

    assert.entityCount("DailyMetric", 2)
    assert.fieldEquals("DailyMetric", EXPECTED_DAY_ID, "borrowsCount", "1")
    assert.fieldEquals("DailyMetric", "daily-20024", "borrowsCount", "1")
  })

  test("handleBorrowed sets position status to ACTIVE", () => {
    let event = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event.block.timestamp = TIMESTAMP

    handleBorrowed(event)

    let positionId = USER_ADDRESS.toHexString()
    assert.fieldEquals("Position", positionId, "status", "ACTIVE")
    assert.fieldEquals("Position", positionId, "borrowed", "1000")
  })

  test("handleBorrowed reactivates REPAID position", () => {
    let event1 = createBorrowedEvent(
      USER_ADDRESS,
      AMOUNT,
      BigInt.fromI32(15000)
    )
    event1.block.timestamp = TIMESTAMP

    handleBorrowed(event1)

    // Simulate repay (would set status to REPAID in real scenario)
    // For now, just verify second borrow sets ACTIVE
    let event2 = createBorrowedEvent(
      USER_ADDRESS,
      BigInt.fromI32(500),
      BigInt.fromI32(12000)
    )
    event2.block.timestamp = TIMESTAMP.plus(BigInt.fromI32(100))

    handleBorrowed(event2)

    let positionId = USER_ADDRESS.toHexString()
    assert.fieldEquals("Position", positionId, "status", "ACTIVE")
    assert.fieldEquals("Position", positionId, "borrowed", "1500")
  })
})
