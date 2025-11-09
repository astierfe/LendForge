"use client";

import { useReadContract, useAccount } from "wagmi";
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses";
import {
  POSITION_READ_ABIS,
  calculatePosition,
  OnChainPosition,
} from "@/lib/utils/position";

const REFRESH_INTERVAL = 5000; // 5s refresh

/**
 * Centralized hook for all on-chain position data
 *
 * Replaces:
 * - useBorrowedAmount (borrowed ETH)
 * - Manual getUserCollaterals reads (collateral USD)
 * - Manual getPrice reads (ETH price)
 *
 * Returns:
 * - Complete position with LTV, borrowed, collateral, all from on-chain
 * - Single source of truth for dashboard, repay, borrow forms
 *
 * WHY: Prevents data inconsistencies from fetching same data in multiple places
 */
export function useOnChainPosition(): {
  position: OnChainPosition;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { address } = useAccount();

  // 1. Read borrowed amount (ETH, 18 decimals)
  const {
    data: borrowedWei,
    isLoading: borrowLoading,
    error: borrowError,
    refetch: refetchBorrow,
  } = useReadContract({
    address: CONTRACTS.LENDING_POOL,
    abi: POSITION_READ_ABIS.GET_BORROWED_AMOUNT,
    functionName: "getBorrowedAmount",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  // 2. Read collateral values (USD, 8 decimals)
  const {
    data: collateralData,
    isLoading: collateralLoading,
    error: collateralError,
    refetch: refetchCollateral,
  } = useReadContract({
    address: CONTRACTS.COLLATERAL_MANAGER,
    abi: POSITION_READ_ABIS.GET_USER_COLLATERALS,
    functionName: "getUserCollaterals",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  // 3. Read ETH price (USD, 8 decimals)
  const {
    data: ethPriceWei,
    isLoading: priceLoading,
    error: priceError,
    refetch: refetchPrice,
  } = useReadContract({
    address: CONTRACTS.ORACLE_AGGREGATOR,
    abi: POSITION_READ_ABIS.GET_PRICE,
    functionName: "getPrice",
    args: [TOKENS.ETH],
    query: {
      refetchInterval: REFRESH_INTERVAL,
    },
  });

  // Debug: Log raw collateral data
  console.log('[useOnChainPosition] collateralData:', {
    full: collateralData,
    assets: collateralData?.[0],
    amounts: collateralData?.[1],
    valuesUSD: collateralData?.[2],
  });

  // Calculate position from on-chain data
  // Pass full collateralData (not just valuesUSD) for ANO_003 workaround
  const position = calculatePosition(
    borrowedWei,
    collateralData,
    ethPriceWei
  );

  // Aggregate loading/error states
  const isLoading = borrowLoading || collateralLoading || priceLoading;
  const error = borrowError || collateralError || priceError;

  // Unified refetch
  const refetch = () => {
    refetchBorrow();
    refetchCollateral();
    refetchPrice();
  };

  return {
    position,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
