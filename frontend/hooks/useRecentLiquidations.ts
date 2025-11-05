"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { useState } from "react";
import { GET_RECENT_LIQUIDATIONS } from "@/lib/graphql/queries/metrics";
import { formatters } from "./useUserPosition";

/**
 * Type definitions for Liquidation query response
 * Updated to match actual subgraph schema
 */
export interface LiquidationData {
  id: string;
  user: {
    id: string;
  };
  liquidator: string; // Address as string
  debtRepaid: string; // BigInt as string
  collateralSeizedUSD: string; // BigInt as string (USD value)
  timestamp: string; // Unix timestamp as string
  txHash: string; // Transaction hash
  healthFactorBefore: string; // BigDecimal as string
  blockNumber: string; // BigInt as string
}

export interface LiquidationsResponse {
  liquidations: LiquidationData[];
}

/**
 * Formatted liquidation for display
 * Note: assetSymbol/assetAddress removed as collateralAsset field doesn't exist in schema
 */
export interface FormattedLiquidation {
  id: string;
  userAddress: string;
  userAddressTruncated: string; // e.g., "0x1234...5678"
  liquidatorAddress: string;
  liquidatorAddressTruncated: string;
  debtRepaid: number; // USD value
  collateralSeizedUSD: number; // USD value
  healthFactorBefore: number; // Health factor before liquidation
  timestamp: Date;
  timestampLabel: string; // e.g., "2 hours ago"
  txHash: string;
  etherscanUrl: string; // Link to Etherscan
}

/**
 * Filter options for liquidations
 * Note: Asset filter removed as we don't have collateralAsset field in schema
 */
export type TimeFilter = "7d" | "30d" | "all";

/**
 * Truncate Ethereum address for display
 */
const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

/**
 * Custom hook to fetch recent liquidations with time filtering
 *
 * Note: Asset filter removed as collateralAsset field doesn't exist in schema
 *
 * Usage:
 * ```tsx
 * const { liquidations, timeFilter, setTimeFilter } =
 *   useRecentLiquidations({ first: 10 });
 *
 * // Display liquidations
 * {liquidations.map(liq => (
 *   <div key={liq.id}>
 *     {liq.userAddressTruncated} liquidated - ${liq.debtRepaid}
 *   </div>
 * ))}
 *
 * // Change filter
 * <button onClick={() => setTimeFilter("7d")}>Show Last 7 Days</button>
 * ```
 *
 * @param options.first - Number of liquidations to fetch (default: 10)
 * @param options.defaultTimeFilter - Default time filter (default: "all")
 * @returns {Object} Liquidations with filter controls
 * - liquidations: Array of formatted liquidations
 * - rawData: Raw subgraph data
 * - timeFilter: Current time filter
 * - setTimeFilter: Function to change time filter
 * - isLoading: Boolean loading state
 * - error: Error object if query failed
 */
export function useRecentLiquidations(options?: {
  first?: number;
  defaultTimeFilter?: TimeFilter;
}) {
  const first = options?.first ?? 10;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(
    options?.defaultTimeFilter ?? "all"
  );

  // Fetch liquidations from subgraph
  const { data, error } = useSuspenseQuery<LiquidationsResponse>(
    GET_RECENT_LIQUIDATIONS,
    {
      variables: {
        first: first * 3, // Fetch more to account for filtering
      },
    }
  );

  const liquidationsData = data?.liquidations ?? [];

  // Calculate time cutoff for filtering
  const getTimeCutoff = (): number => {
    const now = Math.floor(Date.now() / 1000);
    if (timeFilter === "7d") return now - 7 * 24 * 60 * 60;
    if (timeFilter === "30d") return now - 30 * 24 * 60 * 60;
    return 0; // "all" - no cutoff
  };

  const timeCutoff = getTimeCutoff();

  // Format and filter liquidations
  const formattedLiquidations: FormattedLiquidation[] = liquidationsData
    .filter((liq) => {
      // Apply time filter only (asset filter removed)
      const timestamp = parseInt(liq.timestamp);
      if (timestamp < timeCutoff) return false;

      return true;
    })
    .slice(0, first) // Limit to requested number
    .map((liq) => {
      const timestamp = parseInt(liq.timestamp);
      const date = new Date(timestamp * 1000);

      // Get Etherscan URL (Sepolia testnet)
      const etherscanUrl = `https://sepolia.etherscan.io/tx/${liq.txHash}`;

      return {
        id: liq.id,
        userAddress: liq.user.id,
        userAddressTruncated: truncateAddress(liq.user.id),
        liquidatorAddress: liq.liquidator,
        liquidatorAddressTruncated: truncateAddress(liq.liquidator),
        debtRepaid: formatters.weiToEth(liq.debtRepaid ?? "0"),
        collateralSeizedUSD: formatters.weiToEth(liq.collateralSeizedUSD ?? "0"),
        healthFactorBefore: parseFloat(liq.healthFactorBefore ?? "0"),
        timestamp: date,
        timestampLabel: formatRelativeTime(date),
        txHash: liq.txHash,
        etherscanUrl,
      };
    });

  return {
    liquidations: formattedLiquidations,
    rawData: liquidationsData,
    timeFilter,
    setTimeFilter,
    isLoading: !data,
    error,
  };
}
