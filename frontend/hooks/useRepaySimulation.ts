"use client";

import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useOnChainPosition } from "./useOnChainPosition";
import { useAssetConfigs } from "@/lib/utils/assetConfig";
import {
  POSITION_READ_ABIS,
} from "@/lib/utils/position";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { GLOBAL_LIQUIDATION_THRESHOLD } from "@/lib/contracts/config";

export interface RepaySimulationResult {
  /** Simulated health factor after repay */
  simulatedHealthFactor: number | null;
  /** Maximum repayable amount in ETH (current borrowed + estimated interest) */
  maxRepayableETH: bigint;
  /** Whether the repay amount is valid */
  isValidAmount: boolean;
  /** Warning message if any */
  warningMessage: string | null;
  /** Current borrowed amount in ETH */
  currentBorrowedETH: number;
  /** New total borrowed after repay */
  newBorrowedETH: number;
  /** ETH price in USD */
  ethPriceUSD: number | null;
  /** Estimated interest accrued (approximate) */
  estimatedInterestETH: number;
}

/**
 * Hook to simulate repay operation and calculate health factor impact
 *
 * REFACTORED v6.1.1: Now uses 100% on-chain data (no subgraph, no hardcoded prices)
 * - useOnChainPosition() for borrowed amount, collateral, prices
 * - useAssetConfigs() for liquidation thresholds (from contracts)
 * - calculateWeightedLiquidationThreshold() utility
 *
 * Usage:
 * ```tsx
 * const simulation = useRepaySimulation("0.5"); // Repay 0.5 ETH
 *
 * if (!simulation.isValidAmount) {
 *   return <Alert>{simulation.warningMessage}</Alert>
 * }
 *
 * <div>Simulated HF: {simulation.simulatedHealthFactor}</div>
 * ```
 */
export function useRepaySimulation(
  repayAmountETH: string
): RepaySimulationResult {
  const { address } = useAccount();

  // Get on-chain position (centralized - includes borrowed, collateral, ETH price)
  // position.collateralUSD already handles ANO_003 workaround (amount × oraclePrice)
  const { position } = useOnChainPosition();
  const { borrowedETH: currentBorrowedETH, ethPriceUSD, collateralUSD } = position;

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

  // Get asset configs from contracts (liquidation thresholds)
  const { configs: assetConfigs, isLoading: configsLoading } = useAssetConfigs(collateralData?.[0]);

  const simulation = useMemo((): RepaySimulationResult => {
    // Default empty result
    const emptyResult: RepaySimulationResult = {
      simulatedHealthFactor: null,
      maxRepayableETH: BigInt(0),
      isValidAmount: false,
      warningMessage: null,
      currentBorrowedETH: 0,
      newBorrowedETH: 0,
      ethPriceUSD: null,
      estimatedInterestETH: 0,
    };

    // Must have active borrow (use on-chain data)
    if (currentBorrowedETH === 0) {
      return {
        ...emptyResult,
        ethPriceUSD,
        warningMessage: "No active borrows to repay.",
      };
    }

    // Must have collateral data (for HF calculation)
    if (!collateralData || !collateralData[0] || collateralData[0].length === 0) {
      return {
        ...emptyResult,
        ethPriceUSD,
        currentBorrowedETH,
        warningMessage: "Unable to load collateral data.",
      };
    }

    // Must have asset configs loaded
    if (configsLoading || Object.keys(assetConfigs).length === 0) {
      return {
        ...emptyResult,
        ethPriceUSD,
        currentBorrowedETH,
        warningMessage: "Loading asset configurations...",
      };
    }

    // No interest accrual in current contract implementation (fixed rate, no time-based accrual)
    // Contract will refund any excess payment (see LendingPool.sol:143-147)
    const estimatedInterestETH = 0;

    // Max repayable = current borrowed amount
    const maxRepayableETH = BigInt(Math.ceil(currentBorrowedETH * 1e18));

    // Parse repay amount
    const repayAmount = parseFloat(repayAmountETH || "0");

    if (isNaN(repayAmount) || repayAmount <= 0) {
      return {
        simulatedHealthFactor: null,
        maxRepayableETH,
        isValidAmount: false,
        warningMessage: null,
        currentBorrowedETH,
        newBorrowedETH: currentBorrowedETH,
        ethPriceUSD,
        estimatedInterestETH,
      };
    }

    // Calculate new borrowed amount after repay
    const newBorrowedETH = Math.max(0, currentBorrowedETH - repayAmount);
    const newBorrowedUSD = newBorrowedETH * ethPriceUSD;

    // Calculate simulated health factor using GLOBAL threshold (matches contract)
    // Contract formula: HF = (collateralUSD * LIQUIDATION_THRESHOLD) / borrowedUSD
    // See: contracts/libraries/HealthCalculator.sol line 24-25
    // Note: collateralUSD from useOnChainPosition already handles ANO_003 workaround
    let simulatedHealthFactor: number | null = null;
    if (newBorrowedUSD > 0) {
      const adjustedCollateral = collateralUSD * GLOBAL_LIQUIDATION_THRESHOLD;
      simulatedHealthFactor = adjustedCollateral / newBorrowedUSD;
    } else {
      simulatedHealthFactor = Infinity; // No debt = infinite HF
    }

    // Validation checks
    let warningMessage: string | null = null;
    let isValidAmount = true;

    // Note: We don't check wallet balance here (form will handle that with useBalance)
    // Contract will revert if insufficient funds anyway

    // Check if repaying more than borrowed (warning, not error - contract handles this)
    if (repayAmount > currentBorrowedETH + estimatedInterestETH) {
      warningMessage = `Repay amount exceeds total debt (~${(currentBorrowedETH + estimatedInterestETH).toFixed(4)} ETH). Contract will only charge what's owed.`;
      isValidAmount = true; // Still valid, just a warning
    }

    return {
      simulatedHealthFactor,
      maxRepayableETH,
      isValidAmount,
      warningMessage,
      currentBorrowedETH,
      newBorrowedETH,
      ethPriceUSD,
      estimatedInterestETH,
    };
  }, [collateralData, assetConfigs, repayAmountETH, currentBorrowedETH, ethPriceUSD, collateralUSD, configsLoading]);

  return simulation;
}
