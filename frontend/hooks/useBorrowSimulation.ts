"use client";

import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { useOnChainPosition } from "./useOnChainPosition";
import { useAssetConfigs } from "@/lib/utils/assetConfig";
import {
  calculateWeightedLTV,
  POSITION_READ_ABIS,
} from "@/lib/utils/position";
import { HEALTH_FACTOR, GLOBAL_LIQUIDATION_THRESHOLD } from "@/lib/contracts/config";
import { CONTRACTS } from "@/lib/contracts/addresses";

export interface BorrowSimulationResult {
  /** Simulated health factor after borrow */
  simulatedHealthFactor: number | null;
  /** Available to borrow amount in ETH (max - current borrowed) */
  maxBorrowableETH: bigint;
  /** Available to borrow amount in USD (max - current borrowed) */
  maxBorrowableUSD: number;
  /** Whether the borrow amount is valid */
  isValidAmount: boolean;
  /** Warning message if any */
  warningMessage: string | null;
  /** Current borrowed amount in ETH */
  currentBorrowedETH: number;
  /** New total borrowed after this borrow */
  newTotalBorrowedETH: number;
  /** ETH price in USD */
  ethPriceUSD: number | null;
}

/**
 * Hook to simulate borrow operation and calculate health factor impact
 *
 * REFACTORED v6.1.1: Now uses 100% on-chain data (no subgraph, no hardcoded prices)
 * - useOnChainPosition() for borrowed amount, collateral, ETH price
 * - useAssetConfigs() for LTV, liquidation thresholds, prices (from contracts)
 * - calculateWeightedLTV() and calculateWeightedLiquidationThreshold() utilities
 *
 * Usage:
 * ```tsx
 * const simulation = useBorrowSimulation("0.5"); // Borrow 0.5 ETH
 *
 * if (!simulation.isValidAmount) {
 *   return <Alert>{simulation.warningMessage}</Alert>
 * }
 *
 * <div>Simulated HF: {simulation.simulatedHealthFactor}</div>
 * ```
 */
export function useBorrowSimulation(
  borrowAmountETH: string
): BorrowSimulationResult {
  const { address } = useAccount();

  // Get on-chain position data (borrowed amount, collateral, ETH price)
  // position.collateralUSD already handles ANO_003 workaround (amount × oraclePrice)
  const { position } = useOnChainPosition();
  const { borrowedETH: currentBorrowedETH, borrowedUSD: currentBorrowedUSD, ethPriceUSD, collateralUSD } = position;

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

  // Get asset configs from contracts (LTV, liquidation threshold, prices)
  const { configs: assetConfigs, isLoading: configsLoading } = useAssetConfigs(collateralData?.[0]);

  const simulation = useMemo((): BorrowSimulationResult => {
    // Default empty result
    const emptyResult: BorrowSimulationResult = {
      simulatedHealthFactor: null,
      maxBorrowableETH: BigInt(0),
      maxBorrowableUSD: 0,
      isValidAmount: false,
      warningMessage: null,
      currentBorrowedETH: 0,
      newTotalBorrowedETH: 0,
      ethPriceUSD: null,
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

    // Calculate weighted LTV (max borrowable in USD)
    const totalWeightedLTV = calculateWeightedLTV(collateralData, assetConfigs);

    // Calculate available to borrow (subtract current borrowed)
    const availableToBorrowUSD = Math.max(0, totalWeightedLTV - currentBorrowedUSD);
    const availableToBorrowETH = ethPriceUSD > 0 ? availableToBorrowUSD / ethPriceUSD : 0;

    // Convert available to ETH bigint
    const maxBorrowableETH = parseEther(availableToBorrowETH.toFixed(18));

    // Parse borrow amount
    const borrowAmount = parseFloat(borrowAmountETH || "0");

    if (isNaN(borrowAmount) || borrowAmount <= 0) {
      return {
        simulatedHealthFactor: null,
        maxBorrowableETH,
        maxBorrowableUSD: availableToBorrowUSD,
        isValidAmount: false,
        warningMessage: null,
        currentBorrowedETH,
        newTotalBorrowedETH: currentBorrowedETH,
        ethPriceUSD,
      };
    }

    const newTotalBorrowedETH = currentBorrowedETH + borrowAmount;
    const newTotalBorrowedUSD = newTotalBorrowedETH * ethPriceUSD;

    // Calculate simulated health factor using GLOBAL threshold (matches contract)
    // Contract formula: HF = (collateralUSD * LIQUIDATION_THRESHOLD) / borrowedUSD
    // See: contracts/libraries/HealthCalculator.sol line 24-25
    // Note: collateralUSD from useOnChainPosition already handles ANO_003 workaround
    let simulatedHealthFactor: number | null = null;
    if (newTotalBorrowedUSD > 0) {
      const adjustedCollateral = collateralUSD * GLOBAL_LIQUIDATION_THRESHOLD;
      simulatedHealthFactor = adjustedCollateral / newTotalBorrowedUSD;
    } else {
      simulatedHealthFactor = Infinity;
    }

    // Validation checks
    let warningMessage: string | null = null;
    let isValidAmount = true;

    // Check if amount exceeds available
    if (borrowAmount > availableToBorrowETH) {
      warningMessage = `Amount exceeds available credit (${availableToBorrowETH.toFixed(4)} ETH)`;
      isValidAmount = false;
    }
    // Check if HF would be below minimum (1.0)
    else if (simulatedHealthFactor !== null && simulatedHealthFactor < 1.0) {
      warningMessage = `Health factor too low (${simulatedHealthFactor.toFixed(2)}). Minimum is 1.0`;
      isValidAmount = false;
    }
    // Warning if HF is below 1.5 (but above 1.0)
    else if (
      simulatedHealthFactor !== null &&
      simulatedHealthFactor < HEALTH_FACTOR.WARNING
    ) {
      warningMessage = `Warning: Health factor will be ${simulatedHealthFactor.toFixed(2)}. Risk of liquidation increases below 1.5`;
      isValidAmount = true; // Still valid, just a warning
    }

    return {
      simulatedHealthFactor,
      maxBorrowableETH,
      maxBorrowableUSD: availableToBorrowUSD,
      isValidAmount,
      warningMessage,
      currentBorrowedETH,
      newTotalBorrowedETH,
      ethPriceUSD,
    };
  }, [collateralData, assetConfigs, borrowAmountETH, currentBorrowedETH, currentBorrowedUSD, ethPriceUSD, collateralUSD, configsLoading]);

  return simulation;
}
