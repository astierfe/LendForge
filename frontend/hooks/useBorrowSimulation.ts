"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { parseEther, formatUnits } from "viem";
import { useUserPosition, formatters } from "./useUserPosition";
import { HEALTH_FACTOR } from "@/lib/contracts/config";
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses";

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
  const { data: user } = useUserPosition();

  // Get ETH price from oracle
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
    args: [TOKENS.ETH], // ETH address
  });

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

    // Must have user position
    if (!user) {
      return {
        ...emptyResult,
        warningMessage: "No position found. Please deposit collateral first.",
      };
    }

    // Must have collateral
    if (!user.collaterals || user.collaterals.length === 0) {
      return {
        ...emptyResult,
        warningMessage: "No collateral deposited.",
      };
    }

    // Parse ETH price (8 decimals - Chainlink format)
    if (!ethPrice) {
      return {
        ...emptyResult,
        warningMessage: "Unable to fetch ETH price.",
      };
    }

    const ethPriceUSD = parseFloat(formatUnits(ethPrice as bigint, 8));

    // Parse user position data
    const currentBorrowedETH = formatters.weiToEth(user.totalBorrowed); // 18 decimals

    // Calculate weighted LTV from collaterals
    // NOTE: col.valueUSD from subgraph is BUGGY (ANO_003: contains total position value, not individual collateral)
    // Workaround: Calculate valueUSD ourselves using amount * price from oracle
    let totalWeightedLTV = 0;

    for (const col of user.collaterals) {
      // Parse amount based on decimals
      const amount = formatters.tokenToNumber(col.amount, col.asset.decimals, col.asset.symbol);

      // Get price for this asset (use ETH price for ETH, $1 for stablecoins)
      let assetPriceUSD = 1; // Default for stablecoins (USDC, DAI)
      if (col.asset.symbol === "ETH") {
        assetPriceUSD = ethPriceUSD;
      }

      // Calculate correct valueUSD
      const colValueUSD = amount * assetPriceUSD;

      const colLTV = col.asset.ltv / 100; // Convert percentage to decimal
      totalWeightedLTV += colValueUSD * colLTV;
    }

    // Calculate max borrowable in USD (total theoretical max based on LTV)
    const maxBorrowableUSD = totalWeightedLTV;

    // Calculate available to borrow (subtract current borrowed)
    const currentBorrowedUSD = currentBorrowedETH * ethPriceUSD;
    const availableToBorrowUSD = Math.max(0, maxBorrowableUSD - currentBorrowedUSD);
    const availableToBorrowETH = availableToBorrowUSD / ethPriceUSD;

    // Convert available to ETH bigint (this is what the user can actually borrow now)
    const maxBorrowableETH = parseEther(
      availableToBorrowETH.toFixed(18)
    );

    // Parse borrow amount
    const borrowAmount = parseFloat(borrowAmountETH || "0");

    if (isNaN(borrowAmount) || borrowAmount <= 0) {
      return {
        simulatedHealthFactor: null,
        maxBorrowableETH,
        maxBorrowableUSD: availableToBorrowUSD, // Return available, not max total
        isValidAmount: false,
        warningMessage: null,
        currentBorrowedETH,
        newTotalBorrowedETH: currentBorrowedETH,
        ethPriceUSD,
      };
    }

    const newTotalBorrowedETH = currentBorrowedETH + borrowAmount;
    const newTotalBorrowedUSD = newTotalBorrowedETH * ethPriceUSD;

    // Calculate weighted liquidation threshold for HF calculation
    let totalWeightedLiquidationThreshold = 0;
    for (const col of user.collaterals) {
      const colValueUSD = formatters.usdToNumber(col.valueUSD);
      const colLiqThreshold = col.asset.liquidationThreshold / 100; // Convert percentage to decimal
      totalWeightedLiquidationThreshold += colValueUSD * colLiqThreshold;
    }

    // Calculate simulated health factor
    // HF = (totalCollateralUSD * liquidationThreshold) / totalBorrowedUSD
    let simulatedHealthFactor: number | null = null;
    if (newTotalBorrowedUSD > 0) {
      simulatedHealthFactor = totalWeightedLiquidationThreshold / newTotalBorrowedUSD;
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
      maxBorrowableUSD: availableToBorrowUSD, // Return available, not max total
      isValidAmount,
      warningMessage,
      currentBorrowedETH,
      newTotalBorrowedETH,
      ethPriceUSD,
    };
  }, [user, borrowAmountETH, ethPrice]);

  return simulation;
}
