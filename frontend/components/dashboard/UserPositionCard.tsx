"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, AlertCircle, ArrowRight } from "lucide-react";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import { calculateMaxBorrowable } from "@/hooks/useHealthFactor";
import Link from "next/link";

/**
 * UserPositionCard - Displays user's borrowing position
 *
 * Shows:
 * - Total borrowed (ETH)
 * - Available to borrow (calculated from collateral * LTV - current borrowed)
 * - Current LTV used (%)
 * - Links to manage position (Borrow/Repay)
 *
 * Data source: useUserPosition hook + calculateMaxBorrowable helper
 */
export function UserPositionCard() {
  const { data: user, hasActiveBorrow } = useUserPosition();

  // Debug: Log to verify data
  console.log('[UserPositionCard] User data:', user?.id, 'hasActiveBorrow:', hasActiveBorrow);

  // Constants
  const ETH_PRICE = 2500; // Hardcoded ETH price (same as TVLOverviewCard)

  // If no active borrow, show empty state
  if (!user || !hasActiveBorrow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Your Borrowing Position
          </CardTitle>
          <CardDescription>Your borrowed assets and available credit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No active borrowing position</p>
            <p className="text-xs mt-2">Deposit collateral to start borrowing</p>
            {user && user.collaterals.length > 0 && (
              <Link href="/borrow" className="mt-4 inline-block">
                <Button size="sm" className="mt-2">
                  Start Borrowing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse total borrowed (ETH with 18 decimals)
  const totalBorrowedETH = formatters.weiToEth(user.totalBorrowed);
  const totalBorrowedUSD = totalBorrowedETH * ETH_PRICE;

  // Parse total collateral (USD with 8 decimals)
  const totalCollateralUSD = formatters.usdToNumber(user.totalCollateralUSD);

  // Calculate max borrowable and available to borrow
  const maxBorrowableUSD = calculateMaxBorrowable(
    user.totalCollateralUSD,
    user.totalBorrowed,
    user.collaterals
  );
  const availableToBorrowUSD = Math.max(0, maxBorrowableUSD - totalBorrowedUSD);
  const availableToBorrowETH = availableToBorrowUSD / ETH_PRICE;

  // Calculate current LTV used (%)
  const ltvUsed = totalCollateralUSD > 0 ? (totalBorrowedUSD / totalCollateralUSD) * 100 : 0;

  // Determine if user is approaching max LTV (warning at 80%+ of max)
  const ltvWarningThreshold = 80;
  const showWarning = ltvUsed >= ltvWarningThreshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Your Borrowing Position
        </CardTitle>
        <CardDescription>Your borrowed assets and available credit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Borrowed */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Total Borrowed</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold">
              {totalBorrowedETH.toLocaleString('en-US', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })} ETH
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ≈ ${totalBorrowedUSD.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} USD
          </p>
        </div>

        {/* Borrowing Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Available to Borrow */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Available to Borrow</p>
            <p className="text-2xl font-bold">
              {availableToBorrowETH.toLocaleString('en-US', {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
              })} ETH
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ ${availableToBorrowUSD.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} USD
            </p>
          </div>

          {/* Current LTV Used */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Current LTV Used</p>
            <p className={`text-2xl font-bold ${showWarning ? 'text-orange-600' : ''}`}>
              {ltvUsed.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              of collateral value
            </p>
          </div>
        </div>

        {/* Warning if approaching max LTV */}
        {showWarning && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-orange-800">
              <p className="font-medium">High LTV Usage</p>
              <p className="mt-1">You're using a high percentage of your borrowing capacity. Consider depositing more collateral or repaying some debt.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Link href="/borrow" className="flex-1">
            <Button
              variant="default"
              className="w-full"
              disabled={availableToBorrowUSD <= 0}
            >
              Borrow More
            </Button>
          </Link>
          <Link href="/repay" className="flex-1">
            <Button variant="outline" className="w-full">
              Repay Debt
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
