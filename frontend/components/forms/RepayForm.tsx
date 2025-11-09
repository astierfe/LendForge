"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, TrendingUp, Shield } from "lucide-react";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { useRepaySimulation } from "@/hooks/useRepaySimulation";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useOnChainPosition } from "@/hooks/useOnChainPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Import ABIs
import LendingPoolABI from "@/lib/contracts/abis/LendingPool.json";

/**
 * RepayForm Component
 *
 * Allows users to repay their ETH borrows.
 * Features:
 * - Real-time health factor simulation
 * - MAX button (repay full debt)
 * - Partial or full repayment
 * - Wallet balance validation
 */
export function RepayForm() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [amount, setAmount] = useState("");
  const [isRepaying, setIsRepaying] = useState(false);

  // User data
  const { data: user, refetch: refetchUserPosition } = useUserPosition();

  // Get on-chain position (centralized)
  const { position } = useOnChainPosition();
  const { borrowedETH: totalBorrowedETH, hasActiveBorrow } = position;

  const currentHealthFactor = useHealthFactor();

  // Repay simulation
  const simulation = useRepaySimulation(amount);

  // Get wallet ETH balance
  const { data: walletBalance } = useBalance({
    address: address,
  });

  // Wagmi write hooks
  const {
    writeContract: repay,
    data: repayHash,
    isPending: isRepayPending,
    error: repayError,
  } = useWriteContract();

  // Wait for repay transaction
  const { isLoading: isRepayConfirming, isSuccess: isRepaySuccess } =
    useWaitForTransactionReceipt({
      hash: repayHash,
    });

  // Handle repay success
  useEffect(() => {
    if (isRepaySuccess) {
      setIsRepaying(false);

      // Refetch user position to update dashboard
      setTimeout(() => {
        refetchUserPosition();
      }, 2000); // Wait 2s for subgraph to index

      toast({
        title: "Repayment Successful",
        description: `Successfully repaid ${amount} ETH`,
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }
  }, [isRepaySuccess, amount, toast, router, refetchUserPosition]);

  // Handle repay error
  useEffect(() => {
    if (repayError) {
      setIsRepaying(false);
      toast({
        variant: "destructive",
        title: "Repayment Failed",
        description: repayError.message,
      });
    }
  }, [repayError, toast]);

  // Handle repay button click
  const handleRepay = async () => {
    if (!address || !amount) return;

    setIsRepaying(true);
    try {
      repay({
        address: CONTRACTS.LENDING_POOL,
        abi: LendingPoolABI.abi,
        functionName: "repay",
        value: parseEther(amount), // Send ETH as value
      });
    } catch (error) {
      console.error("Repay error:", error);
      setIsRepaying(false);
      toast({
        variant: "destructive",
        title: "Repayment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle MAX button click
  const handleMaxClick = () => {
    if (simulation.currentBorrowedETH > 0) {
      // Use current borrowed + estimated interest
      const maxRepay = simulation.currentBorrowedETH + simulation.estimatedInterestETH;

      // Check wallet balance
      if (walletBalance) {
        const walletBalanceETH = parseFloat(formatEther(walletBalance.value));
        // Reserve 0.002 ETH for gas (conservative estimate)
        const gasReserve = 0.002;
        // Use min of (debt, wallet balance - gas reserve)
        const maxAffordable = Math.min(maxRepay, walletBalanceETH - gasReserve);
        setAmount(Math.max(0, maxAffordable).toFixed(6));
      } else {
        setAmount(maxRepay.toFixed(6));
      }
    }
  };

  // Wallet balance check - account for gas reserve
  const walletBalanceETH = walletBalance ? parseFloat(formatEther(walletBalance.value)) : 0;
  const gasReserve = 0.002; // Reserve for gas
  const availableForRepay = Math.max(0, walletBalanceETH - gasReserve);
  const hasInsufficientBalance = amount && parseFloat(amount) > availableForRepay;

  // Validation
  const canRepay =
    isConnected &&
    hasActiveBorrow &&
    amount &&
    parseFloat(amount) > 0 &&
    simulation.isValidAmount &&
    !hasInsufficientBalance &&
    !isRepaying &&
    !isRepayPending &&
    !isRepayConfirming;

  // Not connected
  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to repay your loan
        </AlertDescription>
      </Alert>
    );
  }

  // No active borrow
  if (!hasActiveBorrow) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have no active borrows to repay.{" "}
          <a href="/dashboard" className="underline font-medium">
            Go to Dashboard
          </a>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle>Repay Amount</CardTitle>
          <CardDescription>Enter the amount of ETH you want to repay</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repay-amount">Amount (ETH)</Label>
            <div className="relative">
              <Input
                id="repay-amount"
                type="number"
                step="0.000001"
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

          {/* Current Debt Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Borrowed</span>
              <span className="text-lg font-bold text-red-600">
                {simulation.currentBorrowedETH.toFixed(6)} ETH
              </span>
            </div>
            {/* Interest estimation hidden - contract refunds excess anyway */}
            {/* <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Estimated Interest (~30 days)</span>
              <span className="text-sm font-medium text-orange-600">
                +{simulation.estimatedInterestETH.toFixed(6)} ETH
              </span>
            </div> */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">Total Debt</span>
              <span className="text-base font-bold">
                {simulation.currentBorrowedETH.toFixed(6)} ETH
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Your Wallet Balance</span>
              <Badge variant="outline">
                {walletBalanceETH.toFixed(6)} ETH
              </Badge>
            </div>
          </div>

          {/* Insufficient balance warning */}
          {hasInsufficientBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient ETH balance. You have {walletBalanceETH.toFixed(6)} ETH in your wallet (max repayable: {availableForRepay.toFixed(6)} ETH after reserving {gasReserve.toFixed(3)} ETH for gas).
              </AlertDescription>
            </Alert>
          )}
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
              Impact on your position after repayment
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
                <div className="text-sm text-muted-foreground">After Repayment</div>
                <div
                  className={`text-2xl font-bold ${
                    simulation.simulatedHealthFactor === Infinity
                      ? "text-green-600"
                      : simulation.simulatedHealthFactor > 2.0
                      ? "text-green-600"
                      : simulation.simulatedHealthFactor > 1.5
                      ? "text-blue-600"
                      : "text-orange-600"
                  }`}
                >
                  {simulation.simulatedHealthFactor === Infinity
                    ? "∞"
                    : simulation.simulatedHealthFactor.toFixed(2)}
                </div>
                <Badge
                  variant="outline"
                  className={
                    simulation.simulatedHealthFactor === Infinity
                      ? "text-green-600 bg-green-100"
                      : simulation.simulatedHealthFactor > 2.0
                      ? "text-green-600 bg-green-100"
                      : simulation.simulatedHealthFactor > 1.5
                      ? "text-blue-600 bg-blue-100"
                      : "text-orange-600 bg-orange-100"
                  }
                >
                  {simulation.simulatedHealthFactor === Infinity
                    ? "No Debt"
                    : simulation.simulatedHealthFactor > 1.5
                    ? "Improved"
                    : "Better"}
                </Badge>
              </div>
            </div>

            {/* Borrowed Amount */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Current Borrowed</span>
                <span className="font-medium">
                  {simulation.currentBorrowedETH.toFixed(6)} ETH
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">After Repayment</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {simulation.currentBorrowedETH.toFixed(6)} ETH
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-bold text-green-600">
                    {simulation.newBorrowedETH.toFixed(6)} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Positive feedback */}
            {simulation.newBorrowedETH === 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>Full Repayment!</strong> Your debt will be completely cleared.
                </AlertDescription>
              </Alert>
            )}

            {simulation.newBorrowedETH > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  Your health factor will improve, reducing liquidation risk.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning Message */}
      {simulation.warningMessage && (
        <Alert variant="default" className="bg-orange-50 border-orange-200">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-900">
            {simulation.warningMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Repay Button */}
      <Button
        onClick={handleRepay}
        disabled={!canRepay}
        className="w-full"
        size="lg"
      >
        {isRepaying || isRepayPending || isRepayConfirming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isRepayConfirming ? "Confirming..." : "Repaying..."}
          </>
        ) : isRepaySuccess ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Success! Redirecting...
          </>
        ) : (
          <>
            Repay {amount || "0"} ETH
          </>
        )}
      </Button>

      {/* Info Note */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>
          Repaying reduces your debt and improves your health factor
        </p>
        <p>
          You can make partial repayments or repay the full amount
        </p>
      </div>
    </div>
  );
}
