"use client";

import { useMemo } from "react";
import { HEALTH_FACTOR, LIQUIDATION_THRESHOLDS } from "@/lib/contracts/config";
import { useUserPosition, type UserCollateral } from "./useUserPosition";

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
  const { data: user, hasActiveBorrow } = useUserPosition();

  const healthFactorData = useMemo(() => {
    // No user or no active borrow = no health factor to display
    if (!user || !hasActiveBorrow || user.activePositions === 0) {
      return null;
    }

    // Get health factor from active position (contract-calculated)
    // If multiple positions, use the first one (most common case)
    const activePosition = user.positions.find((p) => p.status === "ACTIVE");

    if (!activePosition) {
      return null;
    }

    // Parse health factor - contract returns it scaled by 1e18
    const hf = parseFloat(activePosition.healthFactor) / 1e18;

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
  }, [user, hasActiveBorrow]);

  return healthFactorData;
}

/**
 * Calculate maximum borrowable amount based on collateral
 *
 * Formula: (totalCollateralUSD * weightedLTV) - currentBorrowedUSD
 *
 * @param totalCollateralUSD - Total collateral in USD (8 decimals as string)
 * @param currentBorrowed - Current borrowed amount in ETH (18 decimals as string)
 * @param collaterals - User collaterals for weighted LTV
 * @returns Maximum borrowable in USD (number)
 */
export function calculateMaxBorrowable(
  totalCollateralUSD: string,
  currentBorrowed: string,
  collaterals: UserCollateral[]
): number {
  if (!collaterals.length) return 0;

  const collateralUSD = parseFloat(totalCollateralUSD) / 1e8; // USD has 8 decimals (Chainlink)
  const borrowedETH = parseFloat(currentBorrowed) / 1e18; // ETH has 18 decimals

  // Calculate weighted LTV (simplified - using average)
  // Real contract uses weighted average based on collateral amounts
  const avgLTV = collaterals.reduce((sum, col) => {
    return sum + (col.asset.ltv / 100);
  }, 0) / collaterals.length;

  // IMPORTANT: This is a simplified calculation that returns USD
  // To convert to ETH, we need the ETH/USD price from oracle
  // For now, we assume borrowedETH is negligible or use (maxUSD / ETH_price)
  // TODO: Fetch ETH price and convert properly
  const maxBorrowableUSD = collateralUSD * avgLTV;

  // Rough approximation: assume borrowedETH * $2500 for ETH price
  const borrowedUSD = borrowedETH * 2500; // Hardcoded ETH price for now
  const availableUSD = maxBorrowableUSD - borrowedUSD;

  return Math.max(0, availableUSD); // Cannot be negative, returns USD
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
