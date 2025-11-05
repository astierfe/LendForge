"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/contracts/addresses";

/**
 * Hook to check if Oracle is in emergency mode
 *
 * Emergency mode disables borrowing and liquidations
 * to prevent exploitation during oracle failures.
 *
 * Usage:
 * ```tsx
 * const { isEmergencyMode, isLoading } = useEmergencyMode();
 *
 * if (isEmergencyMode) {
 *   return <Alert>System in emergency mode</Alert>
 * }
 * ```
 */
export function useEmergencyMode() {
  const { data: emergencyMode, isLoading, error } = useReadContract({
    address: CONTRACTS.ORACLE_AGGREGATOR,
    abi: [
      {
        inputs: [],
        name: "emergencyMode",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "emergencyMode",
  });

  return {
    isEmergencyMode: emergencyMode === true,
    isLoading,
    error,
  };
}
