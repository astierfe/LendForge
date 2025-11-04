"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { useAccount } from "wagmi";
import { GET_USER_POSITION_DETAILED } from "@/lib/graphql/queries/metrics";

/**
 * Type definitions for UserPosition query response
 */
export interface CollateralAsset {
  id: string;
  symbol: string;
  decimals: number;
  ltv: number;
  liquidationThreshold: number;
  enabled: boolean;
}

export interface UserCollateral {
  id: string;
  amount: string; // BigInt as string
  valueUSD: string; // BigInt as string
  updatedAt: string;
  asset: CollateralAsset;
}

export interface Position {
  id: string;
  totalCollateralUSD: string; // BigInt as string
  borrowed: string; // BigInt as string
  healthFactor: string; // BigDecimal as string
  status: "ACTIVE" | "REPAID" | "LIQUIDATED";
  createdAt: string;
  updatedAt: string;
}

export interface UserPositionData {
  id: string;
  totalCollateralUSD: string; // BigInt as string (Wei)
  totalBorrowed: string; // BigInt as string (Wei)
  activePositions: number;
  lifetimeDeposits: string;
  lifetimeBorrows: string;
  lifetimeRepayments: string;
  liquidationCount: number;
  createdAt: string;
  updatedAt: string;
  positions: Position[];
  collaterals: UserCollateral[];
}

export interface UserPositionResponse {
  user: UserPositionData | null;
}

/**
 * Custom hook to fetch user position from subgraph
 *
 * Usage:
 * ```tsx
 * const { data, hasPosition, hasDeposits } = useUserPosition();
 *
 * if (!hasPosition) {
 *   return <EmptyState />
 * }
 *
 * const collateralUSD = parseFloat(data.totalCollateralUSD) / 1e18;
 * ```
 *
 * @returns {Object} User position data with helper flags
 * - data: Raw user position data from subgraph
 * - hasPosition: Boolean indicating if user has data in subgraph
 * - hasDeposits: Boolean indicating if user has collateral deposited
 * - hasActiveBorrow: Boolean indicating if user has active positions
 * - loading: Boolean (from Apollo)
 * - error: Error object (from Apollo)
 */
export function useUserPosition() {
  const { address, isConnected } = useAccount();

  // Query user position (will be null if user doesn't exist in subgraph)
  const { data, error, refetch } = useSuspenseQuery<UserPositionResponse>(
    GET_USER_POSITION_DETAILED,
    {
      variables: {
        userId: address?.toLowerCase() || "", // Subgraph stores addresses in lowercase
      },
      skip: !isConnected || !address, // Skip query if wallet not connected
    }
  );

  const user = data?.user;

  return {
    data: user,
    hasPosition: !!user, // User exists in subgraph
    hasDeposits: (user?.collaterals?.length ?? 0) > 0,
    hasActiveBorrow: (user?.activePositions ?? 0) > 0,
    error,
    refetch, // Expose refetch function
  };
}

/**
 * Asset decimals mapping (workaround for subgraph bug)
 * Subgraph incorrectly stores decimals=18 for all assets
 */
const ASSET_DECIMALS: Record<string, number> = {
  ETH: 18,
  USDC: 6,  // USDC uses 6 decimals, not 18
  DAI: 18,
};

/**
 * Helper functions to convert BigInt strings to numbers
 */
export const formatters = {
  /**
   * Convert Wei (BigInt string) to ETH (number)
   * @param wei - Wei amount as string (e.g., "1000000000000000000")
   * @returns ETH amount as number (e.g., 1.0)
   */
  weiToEth: (wei: string): number => {
    return parseFloat(wei) / 1e18;
  },

  /**
   * Convert USD BigInt (8 decimals - Chainlink standard) to number
   * @param usd - USD amount as BigInt string (e.g., "100000000")
   * @returns USD amount as number (e.g., 1.0)
   */
  usdToNumber: (usd: string): number => {
    return parseFloat(usd) / 1e8;
  },

  /**
   * Convert token amount (BigInt string) to number based on decimals
   * @param amount - Token amount as string
   * @param decimals - Token decimals (18 for ETH/DAI, 6 for USDC)
   * @param symbol - Optional symbol to override decimals (workaround for subgraph bug)
   * @returns Token amount as number
   */
  tokenToNumber: (amount: string, decimals: number, symbol?: string): number => {
    // Use correct decimals from mapping if symbol provided
    const actualDecimals = symbol && ASSET_DECIMALS[symbol] ? ASSET_DECIMALS[symbol] : decimals;
    return parseFloat(amount) / Math.pow(10, actualDecimals);
  },

  /**
   * Format health factor for display
   * @param healthFactor - Health factor as string (e.g., "2.5")
   * @returns Formatted health factor (e.g., "2.50")
   */
  formatHealthFactor: (healthFactor: string): string => {
    return parseFloat(healthFactor).toFixed(2);
  },
};
