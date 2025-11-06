"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { parseEther, parseUnits, formatUnits } from "viem";
import { useUserPosition, formatters } from "./useUserPosition";
import { HEALTH_FACTOR } from "@/lib/contracts/config";
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
  const { data: user } = useUserPosition();

  // Get asset token address and metadata
  const tokenAddress = TOKENS[asset];
  const assetMetadata = ASSET_METADATA[tokenAddress];

  // Get asset price from oracle
  const { data: assetPrice } = useReadContract({
    address: CONTRACTS.ORACLE_AGGREGATOR,
    abi: [
      {
        inputs: [{ name: "asset", type: "address" }],
        name: "getPrice",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getPrice",
    args: [tokenAddress],
  });

  // Get ETH price for calculations (needed for borrowed amount)
  const { data: ethPrice } = useReadContract({
    address: CONTRACTS.ORACLE_AGGREGATOR,
    abi: [
      {
        inputs: [{ name: "asset", type: "address" }],
        name: "getPrice",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getPrice",
    args: [TOKENS.ETH],
  });

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

    // Must have user position
    if (!user) {
      return {
        ...emptyResult,
        warningMessage: "No position found.",
      };
    }

    // Must have collateral
    if (!user.collaterals || user.collaterals.length === 0) {
      return {
        ...emptyResult,
        warningMessage: "No collateral deposited.",
      };
    }

    // Parse prices (8 decimals - Chainlink format)
    if (!assetPrice || !ethPrice) {
      return {
        ...emptyResult,
        warningMessage: "Unable to fetch asset prices.",
      };
    }

    const assetPriceUSD = parseFloat(formatUnits(assetPrice as bigint, 8));
    const ethPriceUSD = parseFloat(formatUnits(ethPrice as bigint, 8));

    // Find collateral for selected asset
    const selectedCollateral = user.collaterals.find(
      (col) => col.asset.symbol === asset
    );

    if (!selectedCollateral) {
      return {
        ...emptyResult,
        assetPriceUSD,
        warningMessage: `No ${asset} collateral deposited.`,
      };
    }

    // Get current deposited amount
    const currentDepositedAmount = formatters.tokenToNumber(
      selectedCollateral.amount,
      selectedCollateral.asset.decimals,
      selectedCollateral.asset.symbol
    );

    // Parse borrowed amount
    const currentBorrowedETH = formatters.weiToEth(user.totalBorrowed);
    const currentBorrowedUSD = currentBorrowedETH * ethPriceUSD;

    // Calculate current total collateral USD and weighted liquidation threshold
    let currentCollateralUSD = 0;
    let currentWeightedLT = 0;

    for (const col of user.collaterals) {
      const amount = formatters.tokenToNumber(col.amount, col.asset.decimals, col.asset.symbol);

      // Get price for this asset
      let colPriceUSD = 1; // Default for stablecoins
      if (col.asset.symbol === "ETH") {
        colPriceUSD = ethPriceUSD;
      }

      const colValueUSD = amount * colPriceUSD;
      currentCollateralUSD += colValueUSD;

      const colLiqThreshold = col.asset.liquidationThreshold / 100;
      currentWeightedLT += colValueUSD * colLiqThreshold;
    }

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
    const withdrawValueUSD = withdrawAmountNum * assetPriceUSD;
    const newCollateralUSD = currentCollateralUSD - withdrawValueUSD;

    // Calculate new weighted liquidation threshold
    const withdrawLiqThreshold = selectedCollateral.asset.liquidationThreshold / 100;
    const newWeightedLT = currentWeightedLT - (withdrawValueUSD * withdrawLiqThreshold);

    // Calculate simulated health factor
    let simulatedHealthFactor: number | null = null;
    if (currentBorrowedUSD > 0) {
      simulatedHealthFactor = newWeightedLT / currentBorrowedUSD;
    } else {
      simulatedHealthFactor = Infinity; // No debt = can withdraw all
    }

    // Calculate max safe withdraw (HF >= 1.2)
    let maxSafeWithdrawNum = 0;
    if (currentBorrowedUSD === 0) {
      maxSafeWithdrawNum = currentDepositedAmount; // Can withdraw all
    } else {
      // Solve: (currentWeightedLT - withdraw * price * LT) / borrowed >= 1.2
      // withdraw = (currentWeightedLT - 1.2 * borrowed) / (price * LT)
      const targetWeightedLT = HEALTH_FACTOR.WARNING * currentBorrowedUSD;
      const maxWithdrawValueUSD = Math.max(0, (currentWeightedLT - targetWeightedLT) / withdrawLiqThreshold);
      maxSafeWithdrawNum = Math.min(currentDepositedAmount, maxWithdrawValueUSD / assetPriceUSD);
    }

    // Calculate max absolute withdraw (HF >= 1.0)
    let maxAbsoluteWithdrawNum = 0;
    if (currentBorrowedUSD === 0) {
      maxAbsoluteWithdrawNum = currentDepositedAmount;
    } else {
      // Solve: (currentWeightedLT - withdraw * price * LT) / borrowed >= 1.0
      const minWeightedLT = 1.0 * currentBorrowedUSD;
      const maxWithdrawValueUSD = Math.max(0, (currentWeightedLT - minWeightedLT) / withdrawLiqThreshold);
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
  }, [user, asset, withdrawAmount, assetPrice, ethPrice, tokenAddress, assetMetadata.decimals]);

  return simulation;
}
