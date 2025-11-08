/**
 * Hook to fetch user collateral amounts directly from CollateralManager contract
 * Provides real-time updates without requiring transactions
 */

"use client";

import { useReadContract, useAccount } from "wagmi";
import { useEffect } from "react";
import { CONTRACTS } from "@/lib/contracts/addresses";

const COLLATERAL_MANAGER_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserCollaterals",
    outputs: [
      { name: "assets", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "valuesUSD", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const REFRESH_INTERVAL = 5000; // 5 seconds - same as OraclePricesCard

interface CollateralData {
  address: string;
  amount: bigint;
}

interface CollateralAmountsData {
  collaterals: CollateralData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Read collateral amounts from contract (real-time on-chain)
 *
 * @returns Array of user's collateral positions with asset addresses and amounts
 */
export function useCollateralAmounts(): CollateralAmountsData {
  const { address } = useAccount();

  // Read collateral amounts directly from contract
  const {
    data: collateralData,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: CONTRACTS.COLLATERAL_MANAGER,
    abi: COLLATERAL_MANAGER_ABI,
    functionName: "getUserCollaterals",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  // Auto-refresh for real-time updates
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      refetch();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [address, refetch]);

  // Parse collateral data into usable format
  const collaterals: CollateralData[] =
    collateralData && Array.isArray(collateralData[0]) && Array.isArray(collateralData[1])
      ? collateralData[0].map((asset: string, index: number) => ({
          address: asset,
          amount: collateralData[1][index] as bigint,
        }))
      : [];

  return {
    collaterals,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
