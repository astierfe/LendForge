"use client";

import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { useOnChainPosition } from "./useOnChainPosition";
import { useAssetConfigs, getAssetConfig } from "@/lib/utils/assetConfig";
import {
  POSITION_READ_ABIS,
} from "@/lib/utils/position";
import { HEALTH_FACTOR, GLOBAL_LIQUIDATION_THRESHOLD } from "@/lib/contracts/config";
import { CONTRACTS, TOKENS, ASSET_METADATA } from "@/lib/contracts/addresses";

export type SupportedAsset = "ETH" | "USDC" | "DAI";

export interface WithdrawSimulationResult {
  /** Simulated health factor after withdraw */
  simulatedHealthFactor: number | null;
  /** Max safe withdraw keeping HF >= 1.2 */
  maxSafeWithdraw: bigint;
  /** Max absolute withdraw keeping HF >= 1.0 (liquidation threshold) */
  maxAbsoluteWithdraw: bigint;
  /** Whether the withdraw amount is valid (HF >= 1.0) */
  isValidAmount: boolean;
  /** Whether the withdraw is safe (HF >= 1.2) */
  isSafe: boolean;
  /** Warning message if any */
  warningMessage: string | null;
  /** Current total collateral in USD */
  currentCollateralUSD: number;
  /** New total collateral in USD after withdraw */
  newCollateralUSD: number;
  /** Current borrowed in USD */
  currentBorrowedUSD: number;
  /** Asset price in USD */
  assetPriceUSD: number | null;
  /** Current deposited amount of selected asset */
  currentDepositedAmount: number;
}

/**
 * Hook to simulate withdraw operation and calculate health factor impact
 *
 * REFACTORED v6.1.1: Now uses 100% on-chain data (no subgraph, no hardcoded prices)
 * - useOnChainPosition() for borrowed amount, collateral, prices
 * - useAssetConfigs() for liquidation thresholds, prices (from contracts)
 * - calculateWeightedLiquidationThreshold() utility
 *
 * Features:
 * - Calculates new HF after withdrawal
 * - Validates HF safety (>= 1.2 safe, >= 1.0 minimum)
 * - Calculates max safe withdraw amount (keeping HF >= 1.2)
 * - Handles multi-collateral positions
 *
 * Usage:
 * ```tsx
 * const simulation = useWithdrawSimulation("USDC", "1000");
 *
 * if (!simulation.isValidAmount) {
 *   return <Alert>{simulation.warningMessage}</Alert>
 * }
 *
 * if (!simulation.isSafe) {
 *   return <Alert>Warning: HF will be below 1.2</Alert>
 * }
 * ```
 */
export function useWithdrawSimulation(
  asset: SupportedAsset,
  withdrawAmount: string
): WithdrawSimulationResult {
  const { address } = useAccount();

  // Get on-chain position data (borrowed amount, collateral, prices)
  const { position } = useOnChainPosition();
  const { borrowedUSD: currentBorrowedUSD, collateralUSD: currentCollateralUSD, ethPriceUSD } = position;

  // Get asset token address and metadata
  const tokenAddress = TOKENS[asset];
  const assetMetadata = ASSET_METADATA[tokenAddress];

  // Get collateral data from contract
  const { data: collateralData } = useReadContract({
    address: CONTRACTS.COLLATERAL_MANAGER,
    abi: POSITION_READ_ABIS.GET_USER_COLLATERALS,
    functionName: "getUserCollaterals",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  // Get asset configs from contracts (liquidation threshold, prices)
  const { configs: assetConfigs, isLoading: configsLoading } = useAssetConfigs(collateralData?.[0]);

  const simulation = useMemo((): WithdrawSimulationResult => {
    // Default empty result
    const emptyResult: WithdrawSimulationResult = {
      simulatedHealthFactor: null,
      maxSafeWithdraw: BigInt(0),
      maxAbsoluteWithdraw: BigInt(0),
      isValidAmount: false,
      isSafe: false,
      warningMessage: null,
      currentCollateralUSD: 0,
      newCollateralUSD: 0,
      currentBorrowedUSD: 0,
      assetPriceUSD: null,
      currentDepositedAmount: 0,
    };

    // Must have collateral data
    if (!collateralData || !collateralData[0] || collateralData[0].length === 0) {
      return {
        ...emptyResult,
        warningMessage: "No collateral deposited.",
      };
    }

    // Must have asset configs loaded
    if (configsLoading || Object.keys(assetConfigs).length === 0) {
      return {
        ...emptyResult,
        warningMessage: "Loading asset configurations...",
      };
    }

    // Get selected asset config
    const selectedAssetConfig = getAssetConfig(assetConfigs, tokenAddress);
    if (!selectedAssetConfig) {
      return {
        ...emptyResult,
        warningMessage: `Unable to load ${asset} configuration.`,
      };
    }

    const assetPriceUSD = selectedAssetConfig.priceUSD;

    // Find collateral amount for selected asset
    const [assets, amounts] = collateralData;
    const assetIndex = assets.findIndex((addr) => addr.toLowerCase() === tokenAddress.toLowerCase());

    if (assetIndex === -1) {
      return {
        ...emptyResult,
        assetPriceUSD,
        warningMessage: `No ${asset} collateral deposited.`,
      };
    }

    // Get current deposited amount
    const currentDepositedAmount = Number(amounts[assetIndex]) / Math.pow(10, assetMetadata.decimals);

    // Parse withdraw amount
    const withdrawAmountNum = parseFloat(withdrawAmount || "0");

    if (isNaN(withdrawAmountNum) || withdrawAmountNum <= 0) {
      // If no borrow, can withdraw all
      if (currentBorrowedUSD === 0) {
        const maxWithdraw = parseUnits(
          currentDepositedAmount.toFixed(assetMetadata.decimals),
          assetMetadata.decimals
        );
        return {
          simulatedHealthFactor: Infinity,
          maxSafeWithdraw: maxWithdraw,
          maxAbsoluteWithdraw: maxWithdraw,
          isValidAmount: false,
          isSafe: true,
          warningMessage: null,
          currentCollateralUSD,
          newCollateralUSD: currentCollateralUSD,
          currentBorrowedUSD,
          assetPriceUSD,
          currentDepositedAmount,
        };
      }

      return {
        simulatedHealthFactor: null,
        maxSafeWithdraw: BigInt(0),
        maxAbsoluteWithdraw: BigInt(0),
        isValidAmount: false,
        isSafe: false,
        warningMessage: null,
        currentCollateralUSD,
        newCollateralUSD: currentCollateralUSD,
        currentBorrowedUSD,
        assetPriceUSD,
        currentDepositedAmount,
      };
    }

    // Check if withdraw exceeds deposited amount
    if (withdrawAmountNum > currentDepositedAmount) {
      return {
        simulatedHealthFactor: null,
        maxSafeWithdraw: BigInt(0),
        maxAbsoluteWithdraw: BigInt(0),
        isValidAmount: false,
        isSafe: false,
        warningMessage: `Amount exceeds deposited ${asset} (${currentDepositedAmount.toFixed(4)})`,
        currentCollateralUSD,
        newCollateralUSD: currentCollateralUSD,
        currentBorrowedUSD,
        assetPriceUSD,
        currentDepositedAmount,
      };
    }

    // Calculate new collateral after withdraw
    // currentCollateralUSD from useOnChainPosition already handles ANO_003 workaround
    const withdrawValueUSD = withdrawAmountNum * assetPriceUSD;
    const newCollateralUSD = currentCollateralUSD - withdrawValueUSD;

    // Calculate simulated health factor using GLOBAL threshold (matches contract)
    // Contract formula: HF = (collateralUSD * LIQUIDATION_THRESHOLD) / borrowedUSD
    // See: contracts/libraries/HealthCalculator.sol line 24-25
    let simulatedHealthFactor: number | null = null;
    if (currentBorrowedUSD > 0) {
      const adjustedCollateral = newCollateralUSD * GLOBAL_LIQUIDATION_THRESHOLD;
      simulatedHealthFactor = adjustedCollateral / currentBorrowedUSD;
    } else {
      simulatedHealthFactor = Infinity; // No debt = can withdraw all
    }

    // Calculate max safe withdraw (HF >= 1.5)
    // Formula: (collateralUSD - withdraw) * GLOBAL_LT / borrowed >= 1.5
    // Solve: withdraw <= collateralUSD - (1.5 * borrowed / GLOBAL_LT)
    let maxSafeWithdrawNum = 0;
    if (currentBorrowedUSD === 0) {
      maxSafeWithdrawNum = currentDepositedAmount; // Can withdraw all
    } else {
      const minCollateralForSafe = (HEALTH_FACTOR.WARNING * currentBorrowedUSD) / GLOBAL_LIQUIDATION_THRESHOLD;
      const maxWithdrawValueUSD = Math.max(0, currentCollateralUSD - minCollateralForSafe);
      maxSafeWithdrawNum = Math.min(currentDepositedAmount, maxWithdrawValueUSD / assetPriceUSD);
    }

    // Calculate max absolute withdraw (HF >= 1.0)
    // Formula: (collateralUSD - withdraw) * GLOBAL_LT / borrowed >= 1.0
    // Solve: withdraw <= collateralUSD - (borrowed / GLOBAL_LT)
    let maxAbsoluteWithdrawNum = 0;
    if (currentBorrowedUSD === 0) {
      maxAbsoluteWithdrawNum = currentDepositedAmount;
    } else {
      const minCollateralForLiquidation = currentBorrowedUSD / GLOBAL_LIQUIDATION_THRESHOLD;
      const maxWithdrawValueUSD = Math.max(0, currentCollateralUSD - minCollateralForLiquidation);
      maxAbsoluteWithdrawNum = Math.min(currentDepositedAmount, maxWithdrawValueUSD / assetPriceUSD);
    }

    const maxSafeWithdraw = parseUnits(
      maxSafeWithdrawNum.toFixed(assetMetadata.decimals),
      assetMetadata.decimals
    );

    const maxAbsoluteWithdraw = parseUnits(
      maxAbsoluteWithdrawNum.toFixed(assetMetadata.decimals),
      assetMetadata.decimals
    );

    // Validation checks
    let warningMessage: string | null = null;
    let isValidAmount = true;
    let isSafe = true;

    // Check if HF would be below 1.0 (liquidation risk)
    if (simulatedHealthFactor !== null && simulatedHealthFactor !== Infinity && simulatedHealthFactor < 1.0) {
      warningMessage = `Cannot withdraw: Health factor would drop to ${simulatedHealthFactor.toFixed(2)} (below 1.0 minimum). Position would be liquidatable.`;
      isValidAmount = false;
      isSafe = false;
    }
    // Check if HF would be below 1.2 (warning zone)
    else if (simulatedHealthFactor !== null && simulatedHealthFactor !== Infinity && simulatedHealthFactor < HEALTH_FACTOR.WARNING) {
      warningMessage = `Warning: Health factor will drop to ${simulatedHealthFactor.toFixed(2)} (below safe threshold 1.2). Max safe withdraw: ${maxSafeWithdrawNum.toFixed(4)} ${asset}`;
      isValidAmount = true; // Still valid, just risky
      isSafe = false;
    }

    return {
      simulatedHealthFactor,
      maxSafeWithdraw,
      maxAbsoluteWithdraw,
      isValidAmount,
      isSafe,
      warningMessage,
      currentCollateralUSD,
      newCollateralUSD,
      currentBorrowedUSD,
      assetPriceUSD,
      currentDepositedAmount,
    };
  }, [collateralData, assetConfigs, asset, withdrawAmount, tokenAddress, assetMetadata.decimals, currentBorrowedUSD, currentCollateralUSD, ethPriceUSD, configsLoading]);

  return simulation;
}
