"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { GET_DAILY_METRICS } from "@/lib/graphql/queries/metrics";
import { formatters } from "./useUserPosition";

/**
 * Type definitions for DailyMetrics query response
 */
export interface DailyMetricData {
  id: string;
  date: string; // Unix timestamp as string
  totalTVL: string; // BigInt as string
  totalBorrowed: string; // BigInt as string
  ethTVL: string; // BigInt as string
  usdcTVL: string; // BigInt as string
  daiTVL: string; // BigInt as string
  activePositions: string; // BigInt as string
  liquidationsCount: string; // BigInt as string
  volumeDeposited: string; // BigInt as string
  volumeBorrowed: string; // BigInt as string
  volumeRepaid: string; // BigInt as string
}

export interface DailyMetricsResponse {
  dailyMetrics: DailyMetricData[];
}

/**
 * Formatted daily metric for charts (Recharts format)
 */
export interface FormattedDailyMetric {
  date: Date; // JavaScript Date object
  dateLabel: string; // Formatted date string (e.g., "Jan 15")
  timestamp: number; // Unix timestamp (for sorting)
  tvl: number; // Total TVL in USD
  borrowed: number; // Total borrowed in USD
  utilizationRate: number; // Percentage (0-100)
  activePositions: number; // Count
  liquidations: number; // Count
  volume: number; // USD volume
  tvlByAsset: {
    ETH: number;
    USDC: number;
    DAI: number;
  };
}

/**
 * Time period options for filtering
 */
export type TimePeriod = "7d" | "30d" | "all";

/**
 * Custom hook to fetch historical daily metrics from subgraph
 *
 * This hook fetches DailyMetric entities and formats them for use in charts.
 * Data is sorted by date (newest first) and can be filtered by time period.
 *
 * WORKAROUND ANO_005: ETH price is not stored in DailyMetrics, so we pass it as parameter
 * from useGlobalMetrics which fetches it on-chain. This is a temporary workaround until
 * the subgraph stores historical ETH prices.
 *
 * Usage:
 * ```tsx
 * const { metrics: globalMetrics } = useGlobalMetrics();
 * const { metrics } = useDailyMetrics("7d", globalMetrics.ethPrice);
 *
 * // Use in Recharts
 * <LineChart data={metrics}>
 *   <Line dataKey="tvl" stroke="#8884d8" />
 *   <XAxis dataKey="dateLabel" />
 * </LineChart>
 * ```
 *
 * @param defaultPeriod - Default time period ("7d" | "30d" | "all")
 * @param ethPriceFromGlobal - ETH price from useGlobalMetrics (ANO_005 workaround)
 * @returns {Object} Daily metrics with period controls
 * - metrics: Array of formatted daily metrics (ready for Recharts)
 * - rawData: Raw subgraph data (for debugging)
 * - period: Current time period filter
 * - isLoading: Boolean loading state
 * - error: Error object if query failed
 */
export function useDailyMetrics(defaultPeriod: TimePeriod = "7d", ethPriceFromGlobal?: number) {
  // Calculate how many days to fetch based on period
  const daysToFetch = defaultPeriod === "7d" ? 7 : defaultPeriod === "30d" ? 30 : 365;

  // WORKAROUND ANO_005: Use ETH price passed from useGlobalMetrics
  // This avoids race condition between useReadContract (async) and useSuspenseQuery (sync)
  const ethPrice = ethPriceFromGlobal ?? 0;

  // Fetch daily metrics from subgraph
  const { data, error } = useSuspenseQuery<DailyMetricsResponse>(
    GET_DAILY_METRICS,
    {
      variables: {
        first: daysToFetch,
        skip: 0,
      },
    }
  );

  const dailyMetrics = data?.dailyMetrics ?? [];

  // Format metrics for Recharts
  const formattedMetrics: FormattedDailyMetric[] = dailyMetrics.map((metric) => {
    const timestamp = parseInt(metric.date);
    const date = new Date(timestamp * 1000);

    // Parse TVL values (handling ANO_002 - decimal issues)
    const tvlETH = formatters.weiToEth(metric.ethTVL);
    const tvlUSDC = formatters.tokenToNumber(metric.usdcTVL, 6, "USDC");
    const tvlDAI = formatters.weiToEth(metric.daiTVL);

    // Calculate total TVL manually (ANO_004 workaround)
    // Note: metric.totalTVL is buggy (mixed decimals), so we calculate from per-asset values
    // Formula: TVL = (ETH_amount × ETH_price) + (USDC_amount × $1) + (DAI_amount × $1)
    const tvl = (tvlETH * ethPrice) + (tvlUSDC * 1.0) + (tvlDAI * 1.0);

    // Calculate total borrowed: convert Wei to ETH amount, then multiply by ETH price
    const borrowedEth = formatters.weiToEth(metric.totalBorrowed);
    const borrowed = borrowedEth * ethPrice;

    const utilizationRate = tvl > 0 ? (borrowed / tvl) * 100 : 0;

    // Calculate total volume (sum of deposits, borrows, repayments)
    const volumeDeposited = formatters.weiToEth(metric.volumeDeposited);
    const volumeBorrowed = formatters.weiToEth(metric.volumeBorrowed);
    const volumeRepaid = formatters.weiToEth(metric.volumeRepaid);
    const totalVolume = volumeDeposited + volumeBorrowed + volumeRepaid;

    return {
      date,
      dateLabel: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      timestamp,
      tvl,
      borrowed,
      utilizationRate,
      activePositions: parseInt(metric.activePositions),
      liquidations: parseInt(metric.liquidationsCount),
      volume: totalVolume,
      tvlByAsset: {
        ETH: tvlETH,
        USDC: tvlUSDC,
        DAI: tvlDAI,
      },
    };
  });

  // Sort by date (oldest first for charts)
  const sortedMetrics = [...formattedMetrics].reverse();

  return {
    metrics: sortedMetrics,
    rawData: dailyMetrics,
    period: defaultPeriod,
    isLoading: !data,
    error,
  };
}
