/**
 * Hook to fetch borrowed amount directly from LendingPool contract
 * Provides real-time updates without requiring transactions
 */

"use client";

import { useReadContract, useAccount } from "wagmi";
import { useEffect } from "react";
import LendingPoolABI from "@/lib/contracts/abis/LendingPool.json";

const LENDING_POOL_ADDRESS = process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS as `0x${string}`;
const REFRESH_INTERVAL = 5000; // 5 seconds - same as OraclePricesCard

interface BorrowedAmountData {
  borrowedWei: bigint | null;
  borrowedETH: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Read borrowed amount from contract (real-time on-chain)
 *
 * @returns Borrowed amount in Wei and ETH format
 */
export function useBorrowedAmount(): BorrowedAmountData {
  const { address } = useAccount();

  // Read borrowed amount directly from contract
  const {
    data: borrowedWei,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: LendingPoolABI.abi,
    functionName: "getBorrowedAmount",
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

  // Convert Wei to ETH
  const borrowedETH = borrowedWei !== undefined ? Number(borrowedWei) / 1e18 : 0;

  return {
    borrowedWei: borrowedWei !== undefined ? (borrowedWei as bigint) : null,
    borrowedETH,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
