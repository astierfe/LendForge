import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  CollateralDeposited,
  CollateralWithdrawn
} from "../generated/CollateralManager/CollateralManager"
import {
  Borrowed,
  Repaid,
  Liquidated
} from "../generated/LendingPool/LendingPool"

export function createCollateralDepositedEvent(
  user: Address,
  asset: Address,
  amount: BigInt,
  totalCollateralUSD: BigInt
): CollateralDeposited {
  let event = changetype<CollateralDeposited>(newMockEvent())

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  event.parameters.push(
    new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset))
  )
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  event.parameters.push(
    new ethereum.EventParam(
      "totalCollateralUSD",
      ethereum.Value.fromUnsignedBigInt(totalCollateralUSD)
    )
  )

  return event
}

export function createBorrowedEvent(
  user: Address,
  amount: BigInt,
  healthFactor: BigInt
): Borrowed {
  let event = changetype<Borrowed>(newMockEvent())

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  event.parameters.push(
    new ethereum.EventParam(
      "healthFactor",
      ethereum.Value.fromUnsignedBigInt(healthFactor)
    )
  )

  return event
}
