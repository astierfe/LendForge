"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, TrendingDown, Shield } from "lucide-react";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { useBorrowSimulation } from "@/hooks/useBorrowSimulation";
import { useEmergencyMode } from "@/hooks/useEmergencyMode";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Import ABIs
import LendingPoolABI from "@/lib/contracts/abis/LendingPool.json";

/**
 * BorrowForm Component
 *
 * Allows users to borrow ETH against their deposited collateral.
 * Features:
 * - Real-time health factor simulation
 * - Max borrowable calculation
 * - Emergency mode check
 * - Risk warnings
 */
export function BorrowForm() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [amount, setAmount] = useState("");
  const [isBorrowing, setIsBorrowing] = useState(false);

  // User data
  const { data: user, refetch: refetchUserPosition, hasDeposits } = useUserPosition();
  const currentHealthFactor = useHealthFactor();
  const { isEmergencyMode, isLoading: isLoadingEmergencyMode } = useEmergencyMode();

  // Borrow simulation
  const simulation = useBorrowSimulation(amount);

  // Get interest rate from contract
  const { data: borrowRate } = useReadContract({
    address: CONTRACTS.LENDING_POOL,
    abi: LendingPoolABI.abi,
    functionName: "getCurrentBorrowRate",
  });

  // Wagmi write hooks
  const {
    writeContract: borrow,
    data: borrowHash,
    isPending: isBorrowPending,
    error: borrowError,
  } = useWriteContract();

  // Wait for borrow transaction
  const { isLoading: isBorrowConfirming, isSuccess: isBorrowSuccess } =
    useWaitForTransactionReceipt({
      hash: borrowHash,
    });

  // Handle borrow success
  useEffect(() => {
    if (isBorrowSuccess) {
      setIsBorrowing(false);

      // Refetch user position to update dashboard
      setTimeout(() => {
        refetchUserPosition();
      }, 2000); // Wait 2s for subgraph to index

      toast({
        title: "Borrow Successful",
        description: `Successfully borrowed ${amount} ETH`,
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }
  }, [isBorrowSuccess, amount, toast, router, refetchUserPosition]);

  // Handle borrow error
  useEffect(() => {
    if (borrowError) {
      setIsBorrowing(false);
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: borrowError.message,
      });
    }
  }, [borrowError, toast]);

  // Handle borrow button click
  const handleBorrow = async () => {
    if (!address || !amount) return;

    setIsBorrowing(true);
    try {
      borrow({
        address: CONTRACTS.LENDING_POOL,
        abi: LendingPoolABI.abi,
        functionName: "borrow",
        args: [parseEther(amount)],
      });
    } catch (error) {
      console.error("Borrow error:", error);
      setIsBorrowing(false);
      toast({
        variant: "destructive",
        title: "Borrow Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle MAX button click
  const handleMaxClick = () => {
    if (simulation.maxBorrowableETH) {
      // Convert to ETH and format
      const maxETH = formatEther(simulation.maxBorrowableETH);
      // Subtract a small buffer to account for rounding
      const bufferedMax = Math.max(0, parseFloat(maxETH) - 0.0001);
      setAmount(bufferedMax.toFixed(4));
    }
  };

  // Format interest rate
  const interestRateDisplay = useMemo(() => {
    if (!borrowRate) return "5.00%"; // Fallback to hardcoded (from spec)
    // Rate is in basis points (e.g., 500 = 5%)
    const rate = Number(borrowRate) / 100;
    return `${rate.toFixed(2)}%`;
  }, [borrowRate]);

  // Validation
  const canBorrow =
    isConnected &&
    hasDeposits &&
    amount &&
    parseFloat(amount) > 0 &&
    simulation.isValidAmount &&
    !isEmergencyMode &&
    !isBorrowing &&
    !isBorrowPending &&
    !isBorrowConfirming;

  // Not connected
  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to borrow ETH
        </AlertDescription>
      </Alert>
    );
  }

  // No deposits
  if (!hasDeposits) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need to deposit collateral before borrowing.{" "}
          <a href="/deposit" className="underline font-medium">
            Go to Deposit
          </a>
        </AlertDescription>
      </Alert>
    );
  }

  // Emergency mode
  if (isEmergencyMode) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Emergency Mode Active</strong>
          <br />
          Borrowing is temporarily disabled due to oracle issues. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle>Borrow Amount</CardTitle>
          <CardDescription>Enter the amount of ETH you want to borrow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrow-amount">Amount (ETH)</Label>
            <div className="relative">
              <Input
                id="borrow-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-20 text-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
                onClick={handleMaxClick}
              >
                MAX
              </Button>
            </div>
            {simulation.ethPriceUSD && amount && parseFloat(amount) > 0 && (
              <div className="text-sm text-muted-foreground">
                ≈ ${(parseFloat(amount) * simulation.ethPriceUSD).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Available Credit Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available to Borrow</span>
              <span className="text-lg font-bold">
                {formatEther(simulation.maxBorrowableETH)} ETH
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Max Borrowable (USD)</span>
              <span className="text-sm font-medium">
                ${simulation.maxBorrowableUSD.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Interest Rate (APR)</span>
              <Badge variant="outline">{interestRateDisplay}</Badge>
            </div>
            {!borrowRate && (
              <div className="text-xs text-muted-foreground italic">
                * Interest rate is hardcoded (contract value not available)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Health Factor Preview */}
      {amount && parseFloat(amount) > 0 && simulation.simulatedHealthFactor !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Health Factor Preview
            </CardTitle>
            <CardDescription>
              Impact on your position after borrowing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current vs Simulated HF */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Current HF</div>
                <div className="text-2xl font-bold">
                  {currentHealthFactor?.value.toFixed(2) || "∞"}
                </div>
                {currentHealthFactor && (
                  <Badge variant="outline" className={currentHealthFactor.color}>
                    {currentHealthFactor.label}
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Simulated HF</div>
                <div
                  className={`text-2xl font-bold ${
                    simulation.simulatedHealthFactor < 1.0
                      ? "text-red-600"
                      : simulation.simulatedHealthFactor < 1.5
                      ? "text-orange-600"
                      : "text-green-600"
                  }`}
                >
                  {simulation.simulatedHealthFactor === Infinity
                    ? "∞"
                    : simulation.simulatedHealthFactor.toFixed(2)}
                </div>
                <Badge
                  variant="outline"
                  className={
                    simulation.simulatedHealthFactor < 1.0
                      ? "text-red-600 bg-red-100"
                      : simulation.simulatedHealthFactor < 1.5
                      ? "text-orange-600 bg-orange-100"
                      : "text-green-600 bg-green-100"
                  }
                >
                  {simulation.simulatedHealthFactor < 1.0
                    ? "Liquidation Risk"
                    : simulation.simulatedHealthFactor < 1.5
                    ? "Warning"
                    : "Safe"}
                </Badge>
              </div>
            </div>

            {/* Borrowed Amount */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Current Borrowed</span>
                <span className="font-medium">
                  {simulation.currentBorrowedETH.toFixed(4)} ETH
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">New Total Borrowed</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {simulation.currentBorrowedETH.toFixed(4)} ETH
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-bold text-primary">
                    {simulation.newTotalBorrowedETH.toFixed(4)} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            {simulation.simulatedHealthFactor < 1.5 && simulation.simulatedHealthFactor >= 1.0 && (
              <Alert className="bg-orange-50 border-orange-200">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  <strong>Caution:</strong> Your health factor will be below 1.5.
                  Consider borrowing less to maintain a safer position.
                </AlertDescription>
              </Alert>
            )}

            {simulation.simulatedHealthFactor < 1.0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cannot Borrow:</strong> This would put your position at risk
                  of liquidation. Health factor must be above 1.0.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning Message */}
      {simulation.warningMessage && (
        <Alert
          variant={simulation.isValidAmount ? "default" : "destructive"}
          className={simulation.isValidAmount ? "bg-orange-50 border-orange-200" : ""}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{simulation.warningMessage}</AlertDescription>
        </Alert>
      )}

      {/* Borrow Button */}
      <Button
        onClick={handleBorrow}
        disabled={!canBorrow}
        className="w-full"
        size="lg"
      >
        {isBorrowing || isBorrowPending || isBorrowConfirming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isBorrowConfirming ? "Confirming..." : "Borrowing..."}
          </>
        ) : isBorrowSuccess ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Success! Redirecting...
          </>
        ) : (
          <>
            Borrow {amount || "0"} ETH
          </>
        )}
      </Button>

      {/* Info Note */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>
          Minimum health factor: 1.0 | Recommended: &gt; 1.5
        </p>
        <p>
          Interest accrues at {interestRateDisplay} APR on borrowed amount
        </p>
      </div>
    </div>
  );
}
