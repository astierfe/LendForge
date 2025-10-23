// subgraph/src/oracle-aggregator.ts - v3.0 - Oracle deviation tracking
import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  DeviationWarning,
  CriticalDeviation,
  EmergencyModeSet
} from "../generated/OracleAggregator/OracleAggregator"
import {
  PriceDeviation
} from "../generated/schema"

export function handleDeviationWarning(event: DeviationWarning): void {
  let deviationId = event.params.asset.toHexString() + "-" + event.block.timestamp.toString()
  let deviation = new PriceDeviation(deviationId)

  deviation.asset = event.params.asset
  deviation.primaryPrice = event.params.primaryPrice
  deviation.fallbackPrice = event.params.fallbackPrice
  deviation.deviationBps = event.params.deviationBps
  deviation.timestamp = event.block.timestamp
  deviation.blockNumber = event.block.number
  deviation.emergencyTriggered = false

  deviation.save()
}

export function handleCriticalDeviation(event: CriticalDeviation): void {
  let deviationId = event.params.asset.toHexString() + "-" + event.block.timestamp.toString() + "-critical"
  let deviation = new PriceDeviation(deviationId)

  deviation.asset = event.params.asset
  deviation.primaryPrice = event.params.primaryPrice
  deviation.fallbackPrice = event.params.fallbackPrice
  deviation.deviationBps = event.params.deviationBps
  deviation.timestamp = event.block.timestamp
  deviation.blockNumber = event.block.number
  deviation.emergencyTriggered = true

  deviation.save()
}

export function handleEmergencyModeSet(event: EmergencyModeSet): void {
  // Create a special deviation record for emergency mode
  let deviationId = "emergency-" + event.block.timestamp.toString()
  let deviation = new PriceDeviation(deviationId)

  deviation.asset = Bytes.fromHexString("0x0000000000000000000000000000000000000000") // System-wide
  deviation.primaryPrice = BigInt.zero()
  deviation.fallbackPrice = BigInt.zero()
  deviation.deviationBps = BigInt.fromI32(10000) // 100% deviation
  deviation.timestamp = event.block.timestamp
  deviation.blockNumber = event.block.number
  deviation.emergencyTriggered = event.params.enabled

  deviation.save()
}