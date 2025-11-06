"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useUserPosition, formatters } from "./useUserPosition";
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses";

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

    // Must have user position
    if (!user) {
      return {
        ...emptyResult,
        warningMessage: "No position found.",
      };
    }

    // Must have active borrow
    if (!user.totalBorrowed || parseFloat(user.totalBorrowed) === 0) {
      return {
        ...emptyResult,
        warningMessage: "No active borrows to repay.",
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

    // Calculate weighted liquidation threshold for HF calculation
    // NOTE: col.valueUSD from subgraph is BUGGY (ANO_003: contains total position value, not individual collateral)
    // Workaround: Calculate valueUSD ourselves using amount * price from oracle
    let totalCollateralUSD = 0;
    let totalWeightedLiquidationThreshold = 0;

    if (user.collaterals && user.collaterals.length > 0) {
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
        totalCollateralUSD += colValueUSD;

        const colLiqThreshold = col.asset.liquidationThreshold / 100; // Convert percentage to decimal
        totalWeightedLiquidationThreshold += colValueUSD * colLiqThreshold;
      }
    }

    // Calculate simulated health factor
    // HF = (totalCollateralUSD * liquidationThreshold) / totalBorrowedUSD
    let simulatedHealthFactor: number | null = null;
    if (newBorrowedUSD > 0) {
      simulatedHealthFactor = totalWeightedLiquidationThreshold / newBorrowedUSD;
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
  }, [user, repayAmountETH, ethPrice]);

  return simulation;
}
