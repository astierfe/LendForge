"use client";

import { useMemo, useEffect } from "react";
import { useReadContract, useAccount } from "wagmi";
import { HEALTH_FACTOR, LIQUIDATION_THRESHOLDS } from "@/lib/contracts/config";
import { useUserPosition, type UserCollateral } from "./useUserPosition";
import LendingPoolABI from "@/lib/contracts/abis/LendingPool.json";

const LENDING_POOL_ADDRESS = process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS as `0x${string}`;
const REFRESH_INTERVAL = 5000; // 5 seconds - same as OraclePricesCard

/**
 * Health Factor risk levels
 */
export type HealthFactorLevel = "safe" | "warning" | "danger" | "liquidation";

export interface HealthFactorData {
  value: number; // Numeric health factor (e.g., 2.5)
  level: HealthFactorLevel; // Risk level
  percentage: number; // Percentage for gauge display (0-100)
  color: string; // Tailwind color class
  label: string; // Human-readable label
  canBorrow: boolean; // Can user borrow more?
}

/**
 * Calculate weighted average liquidation threshold
 * Formula: (collateral1_usd * threshold1 + collateral2_usd * threshold2 + ...) / total_collateral_usd
 *
 * @param collaterals - User collaterals with asset info
 * @param totalCollateralUSD - Total collateral in USD (BigInt string)
 * @returns Weighted liquidation threshold (0-1)
 */
function calculateWeightedLiquidationThreshold(
  collaterals: UserCollateral[],
  totalCollateralUSD: string
): number {
  if (!collaterals.length || totalCollateralUSD === "0") return 0;

  const totalUSD = parseFloat(totalCollateralUSD) / 1e18;

  const weightedSum = collaterals.reduce((sum, collateral) => {
    const assetSymbol = collateral.asset.symbol as keyof typeof LIQUIDATION_THRESHOLDS;
    const threshold = LIQUIDATION_THRESHOLDS[assetSymbol] || 0;

    // Note: collateral.valueUSD stores TOTAL not individual value
    // So we use Position.totalCollateralUSD instead
    // For now, use the threshold directly from contract (more accurate)
    const weight = collateral.asset.liquidationThreshold / 100; // Convert from percentage

    return sum + weight;
  }, 0);

  // If multiple assets, average the thresholds
  // This is a simplification - real contract uses weighted average
  return weightedSum / collaterals.length;
}

/**
 * Custom hook to calculate and monitor user's health factor
 *
 * NOW READS ON-CHAIN for real-time updates (like OraclePricesCard)
 * No longer depends on subgraph transactions
 *
 * Health Factor Formula:
 * HF = (totalCollateralUSD * liquidationThreshold) / totalBorrowed
 *
 * Risk Levels:
 * - Safe: HF >= 2.0 (green)
 * - Warning: 1.5 <= HF < 2.0 (yellow)
 * - Danger: 1.2 <= HF < 1.5 (orange)
 * - Liquidation: HF < 1.2 (red)
 *
 * Usage:
 * ```tsx
 * const healthFactor = useHealthFactor();
 *
 * if (healthFactor.level === "danger") {
 *   return <Alert>Your position is at risk!</Alert>
 * }
 *
 * <ProgressBar value={healthFactor.percentage} color={healthFactor.color} />
 * ```
 *
 * @returns Health factor data with risk level and display helpers
 */
export function useHealthFactor(): HealthFactorData | null {
  const { address } = useAccount();
  const { data: user, hasActiveBorrow } = useUserPosition();

  // Read health factor directly from contract (real-time on-chain)
  const {
    data: healthFactorRaw,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: LendingPoolABI.abi,
    functionName: "getHealthFactor",
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

  const healthFactorData = useMemo(() => {
    // No address or loading = no health factor yet
    if (!address || isLoading || healthFactorRaw === undefined) {
      return null;
    }

    // Parse health factor from contract
    // Contract returns:
    // - 2 decimal precision (144 = 1.44)
    // - 0xfff...fff = no debt (infinite health factor)
    const NO_DEBT_VALUE = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

    // No debt = no health factor to display
    if (healthFactorRaw === NO_DEBT_VALUE) {
      return null;
    }

    // Convert from 2 decimal precision to float (144 -> 1.44)
    const hf = Number(healthFactorRaw) / 100;

    // Determine risk level
    let level: HealthFactorLevel;
    let color: string;
    let label: string;
    let percentage: number;

    if (hf >= HEALTH_FACTOR.SAFE) {
      level = "safe";
      color = "text-green-600 bg-green-100";
      label = "Safe";
      percentage = Math.min(100, (hf / 3) * 100); // Cap at 100% for display
    } else if (hf >= HEALTH_FACTOR.WARNING) {
      level = "warning";
      color = "text-yellow-600 bg-yellow-100";
      label = "Warning";
      percentage = ((hf - HEALTH_FACTOR.WARNING) / (HEALTH_FACTOR.SAFE - HEALTH_FACTOR.WARNING)) * 100;
    } else if (hf >= HEALTH_FACTOR.DANGER) {
      level = "danger";
      color = "text-orange-600 bg-orange-100";
      label = "Danger";
      percentage = ((hf - HEALTH_FACTOR.DANGER) / (HEALTH_FACTOR.WARNING - HEALTH_FACTOR.DANGER)) * 100;
    } else {
      level = "liquidation";
      color = "text-red-600 bg-red-100";
      label = "At Risk";
      percentage = (hf / HEALTH_FACTOR.DANGER) * 100;
    }

    return {
      value: hf,
      level,
      percentage: Math.max(0, Math.min(100, percentage)), // Clamp 0-100
      color,
      label,
      canBorrow: hf >= HEALTH_FACTOR.WARNING, // Only allow borrowing if HF >= 1.5
    };
  }, [address, isLoading, healthFactorRaw]);

  return healthFactorData;
}

/**
 * Calculate maximum borrowable amount based on collateral
 *
 * Formula: (totalCollateralUSD * weightedLTV) - currentBorrowedUSD
 *
 * @param totalCollateralUSD - Total collateral in USD (8 decimals as string) - NOT USED (buggy subgraph data)
 * @param currentBorrowed - Current borrowed amount in ETH (18 decimals as string) - NOT USED (calculated by caller)
 * @param collaterals - User collaterals for weighted LTV
 * @param ethPriceUSD - ETH price in USD (for ETH collateral calculation)
 * @returns Maximum borrowable in USD (number)
 */
export function calculateMaxBorrowable(
  totalCollateralUSD: string,
  currentBorrowed: string,
  collaterals: UserCollateral[],
  ethPriceUSD: number = 2500 // Default to 2500 for backward compatibility
): number {
  if (!collaterals.length) return 0;

  // Calculate weighted LTV based on collateral USD values
  // NOTE: col.valueUSD from subgraph is BUGGY (ANO_003: contains total position value, not individual collateral)
  // Workaround: Calculate valueUSD ourselves using amount * price
  let totalWeightedLTV = 0;

  for (const col of collaterals) {
    // Parse amount based on decimals - IMPORTANT: Use correct decimals mapping
    // Subgraph stores wrong decimals (18 for all), but USDC actually uses 6
    // Import formatters from useUserPosition to handle this correctly
    const actualDecimals = col.asset.symbol === "USDC" ? 6 : col.asset.decimals;
    const amount = parseFloat(col.amount) / Math.pow(10, actualDecimals);

    // Get price for this asset (use ETH price for ETH, $1 for stablecoins)
    let assetPriceUSD = 1; // Default for stablecoins (USDC, DAI)
    if (col.asset.symbol === "ETH") {
      assetPriceUSD = ethPriceUSD;
    }

    // Calculate correct valueUSD
    const colValueUSD = amount * assetPriceUSD;

    const colLTV = col.asset.ltv / 100; // Convert percentage to decimal

    // Weight the LTV by the collateral's USD value
    totalWeightedLTV += colValueUSD * colLTV;
  }

  // Calculate max borrowable using weighted LTV
  // Note: totalWeightedLTV already accounts for the weighting, so we don't divide by collateralUSD
  const maxBorrowableUSD = totalWeightedLTV;

  return maxBorrowableUSD; // Return max borrowable in USD
}

/**
 * Simulate health factor after borrowing more
 *
 * @param currentHF - Current health factor
 * @param currentBorrowed - Current borrowed amount (Wei as string)
 * @param additionalBorrow - Additional amount to borrow (ETH as number)
 * @returns Simulated new health factor
 */
export function simulateHealthFactor(
  currentHF: number,
  currentBorrowed: string,
  additionalBorrow: number
): number {
  const borrowed = parseFloat(currentBorrowed) / 1e18;
  const newBorrowed = borrowed + additionalBorrow;

  if (newBorrowed === 0) return Infinity;

  // HF = (collateral * threshold) / borrowed
  // If we know current HF and borrowed, we can calculate collateral * threshold
  const collateralTimesThreshold = currentHF * borrowed;

  // New HF with additional borrow
  return collateralTimesThreshold / newBorrowed;
}
