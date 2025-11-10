"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { useReadContract } from "wagmi";
import { GET_GLOBAL_METRICS } from "@/lib/graphql/queries/metrics";
import { formatters } from "./useUserPosition";
import OracleAggregatorABI from "@/lib/contracts/abis/OracleAggregator.json";

/**
 * Type definitions for GlobalMetrics query response
 */
export interface GlobalMetricsData {
  id: string;
  currentTVL: string; // BigInt as string (BUGGY - ANO_004)
  currentBorrowed: string; // BigInt as string
  totalETHDeposited: string; // BigInt as string
  totalUSDCDeposited: string; // BigInt as string
  totalDAIDeposited: string; // BigInt as string
  updatedAt: string;
}

export interface GlobalMetricsResponse {
  globalMetrics: GlobalMetricsData[];
  activeUsers: { id: string }[];
}

/**
 * Formatted metrics ready for display
 */
export interface FormattedGlobalMetrics {
  totalTVL: number; // USD value
  totalBorrowed: number; // USD value
  utilizationRate: number; // Percentage (0-100)
  activePositions: number; // Count of active positions
  tvlByAsset: {
    ETH: { amount: number; valueUSD: number };
    USDC: { amount: number; valueUSD: number };
    DAI: { amount: number; valueUSD: number };
  };
  ethPrice: number; // Current ETH price in USD
  updatedAt: Date;
}

/**
 * Custom hook to fetch global protocol metrics with ANO_004 workaround
 *
 * IMPORTANT: This hook implements workarounds for known subgraph bugs:
 * - ANO_004: GlobalMetric.currentTVL is incorrect (mixed decimals)
 *   → We calculate TVL manually from per-asset totals
 * - ANO_001: GlobalMetric.activePositions always returns 0
 *   → We count users with activePositions > 0
 * - ANO_002: Asset decimals hardcoded to 18 in subgraph
 *   → We use correct decimals (USDC = 6, ETH/DAI = 18)
 *
 * Usage:
 * ```tsx
 * const { metrics, isLoading } = useGlobalMetrics();
 *
 * console.log(`Total TVL: $${metrics.totalTVL.toLocaleString()}`);
 * console.log(`Utilization: ${metrics.utilizationRate.toFixed(2)}%`);
 * ```
 *
 * @returns {Object} Global metrics with helper values
 * - metrics: Formatted global metrics ready for display
 * - rawData: Raw subgraph data (for debugging)
 * - isLoading: Boolean loading state
 * - error: Error object if query failed
 */
export function useGlobalMetrics() {
  // Fetch global metrics from subgraph
  const { data, error } = useSuspenseQuery<GlobalMetricsResponse>(
    GET_GLOBAL_METRICS
  );

  const metricsData = data?.globalMetrics?.[0];
  const activePositionsCount = data?.activeUsers?.length ?? 0;

  // Fetch prices from OracleAggregator contract
  const { data: ethPriceRaw } = useReadContract({
    address: process.env.NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS as `0x${string}`,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [process.env.NEXT_PUBLIC_ETH_ADDRESS], // ETH address
  });

  const { data: usdcPriceRaw } = useReadContract({
    address: process.env.NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS as `0x${string}`,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [process.env.NEXT_PUBLIC_USDC_ADDRESS], // USDC address
  });

  const { data: daiPriceRaw } = useReadContract({
    address: process.env.NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS as `0x${string}`,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [process.env.NEXT_PUBLIC_DAI_ADDRESS], // DAI address
  });

  // Convert prices (8 decimals - Chainlink format) to numbers
  const ethPrice = ethPriceRaw
    ? formatters.usdToNumber(ethPriceRaw.toString())
    : 0;
  const usdcPrice = usdcPriceRaw
    ? formatters.usdToNumber(usdcPriceRaw.toString())
    : 1.0;
  const daiPrice = daiPriceRaw
    ? formatters.usdToNumber(daiPriceRaw.toString())
    : 1.0;

  // Calculate TVL manually (ANO_004 & ANO_009 workaround)
  // Formula: TVL = (ETH_amount × ETH_price) + (USDC_amount × USDC_price) + (DAI_amount × DAI_price)
  const ethAmount = metricsData
    ? formatters.weiToEth(metricsData.totalETHDeposited ?? "0")
    : 0;
  const usdcAmount = metricsData
    ? formatters.tokenToNumber(metricsData.totalUSDCDeposited ?? "0", 6, "USDC")
    : 0;
  const daiAmount = metricsData
    ? formatters.weiToEth(metricsData.totalDAIDeposited ?? "0")
    : 0;

  const ethTVL = ethAmount * ethPrice;
  const usdcTVL = usdcAmount * usdcPrice; // Use oracle price (ANO_009 fix)
  const daiTVL = daiAmount * daiPrice; // Use oracle price (ANO_009 fix)
  const totalTVL = ethTVL + usdcTVL + daiTVL;

  // Calculate total borrowed (convert from Wei to USD)
  // Note: currentBorrowed is stored in Wei in the subgraph
  // We need to convert Wei → ETH amount → USD value (multiply by ETH price)
  const borrowedEth = metricsData
    ? formatters.weiToEth(metricsData.currentBorrowed ?? "0")
    : 0;
  const totalBorrowed = borrowedEth * ethPrice;

  // Calculate utilization rate: (Total Borrowed / Total TVL) × 100
  const utilizationRate = totalTVL > 0 ? (totalBorrowed / totalTVL) * 100 : 0;

  const formattedMetrics: FormattedGlobalMetrics = {
    totalTVL,
    totalBorrowed,
    utilizationRate,
    activePositions: activePositionsCount,
    tvlByAsset: {
      ETH: {
        amount: ethAmount,
        valueUSD: ethTVL,
      },
      USDC: {
        amount: usdcAmount,
        valueUSD: usdcTVL,
      },
      DAI: {
        amount: daiAmount,
        valueUSD: daiTVL,
      },
    },
    ethPrice,
    updatedAt: metricsData
      ? new Date(parseInt(metricsData.updatedAt ?? "0") * 1000)
      : new Date(),
  };

  return {
    metrics: formattedMetrics,
    rawData: metricsData,
    isLoading: !metricsData,
    error,
  };
}
