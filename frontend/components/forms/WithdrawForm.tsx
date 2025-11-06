"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { AssetSelector, SupportedAsset } from "./AssetSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import { CONTRACTS, TOKENS, ASSET_METADATA } from "@/lib/contracts/addresses";
import { useWithdrawSimulation } from "@/hooks/useWithdrawSimulation";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Import ABIs
import CollateralManagerABI from "@/lib/contracts/abis/CollateralManager.json";

/**
 * WithdrawForm Component
 *
 * Allows users to withdraw their collateral (ETH, USDC, DAI).
 * Features:
 * - Multi-asset support (AssetSelector)
 * - Real-time health factor simulation
 * - Max safe withdraw calculation (HF >= 1.2)
 * - Safety validations and warnings
 */
export function WithdrawForm() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("ETH");
  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // User data
  const { data: user, refetch: refetchUserPosition, hasDeposits, hasActiveBorrow } = useUserPosition();
  const currentHealthFactor = useHealthFactor();

  // Withdraw simulation
  const simulation = useWithdrawSimulation(selectedAsset, amount);

  // Get token address and metadata
  const tokenAddress = TOKENS[selectedAsset];
  const assetMetadata = ASSET_METADATA[tokenAddress];
  const isEth = selectedAsset === "ETH";

  // Wagmi write hooks
  const {
    writeContract: withdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  // Wait for withdraw transaction
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } =
    useWaitForTransactionReceipt({
      hash: withdrawHash,
    });

  // Handle withdraw success
  useEffect(() => {
    if (isWithdrawSuccess) {
      setIsWithdrawing(false);

      // Refetch user position to update dashboard
      setTimeout(() => {
        refetchUserPosition();
      }, 2000); // Wait 2s for subgraph to index

      toast({
        title: "Withdrawal Successful",
        description: `Successfully withdrew ${amount} ${selectedAsset}`,
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }
  }, [isWithdrawSuccess, amount, selectedAsset, toast, router, refetchUserPosition]);

  // Handle withdraw error
  useEffect(() => {
    if (withdrawError) {
      setIsWithdrawing(false);
      toast({
        variant: "destructive",
        title: "Withdrawal Failed",
        description: withdrawError.message,
      });
    }
  }, [withdrawError, toast]);

  // Handle withdraw button click
  const handleWithdraw = async () => {
    if (!address || !amount) return;

    setIsWithdrawing(true);
    try {
      // Convert amount to proper units
      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 10 ** assetMetadata.decimals));

      if (isEth) {
        // ETH: CollateralManager.withdrawETH(amount)
        withdraw({
          address: CONTRACTS.COLLATERAL_MANAGER,
          abi: CollateralManagerABI.abi,
          functionName: "withdrawETH",
          args: [amountInUnits],
        });
      } else {
        // ERC20: CollateralManager.withdrawERC20(asset, amount)
        withdraw({
          address: CONTRACTS.COLLATERAL_MANAGER,
          abi: CollateralManagerABI.abi,
          functionName: "withdrawERC20",
          args: [tokenAddress, amountInUnits],
        });
      }
    } catch (error) {
      console.error("Withdraw error:", error);
      setIsWithdrawing(false);
      toast({
        variant: "destructive",
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle MAX button click (safe max, not absolute max)
  const handleMaxClick = () => {
    if (simulation.maxSafeWithdraw) {
      const maxSafe = formatUnits(simulation.maxSafeWithdraw, assetMetadata.decimals);
      setAmount(maxSafe);
    }
  };

  // Validation
  const canWithdraw =
    isConnected &&
    hasDeposits &&
    amount &&
    parseFloat(amount) > 0 &&
    simulation.isValidAmount &&
    !isWithdrawing &&
    !isWithdrawPending &&
    !isWithdrawConfirming;

  // Not connected
  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to withdraw collateral
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
          You have no collateral to withdraw.{" "}
          <a href="/deposit" className="underline font-medium">
            Go to Deposit
          </a>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Asset to Withdraw</CardTitle>
          <CardDescription>Choose which collateral asset you want to withdraw</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetSelector
            selectedAsset={selectedAsset}
            onAssetChange={(asset) => {
              setSelectedAsset(asset);
              setAmount(""); // Reset amount when changing asset
            }}
            balance={simulation.currentDepositedAmount.toFixed(assetMetadata.decimals)}
            price={simulation.assetPriceUSD?.toFixed(2)}
          />
        </CardContent>
      </Card>

      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Amount</CardTitle>
          <CardDescription>Enter the amount of {selectedAsset} you want to withdraw</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount ({selectedAsset})</Label>
            <div className="relative">
              <Input
                id="withdraw-amount"
                type="number"
                step={selectedAsset === "USDC" ? "0.01" : "0.0001"}
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
                disabled={simulation.currentDepositedAmount === 0}
              >
                MAX
              </Button>
            </div>
            {simulation.assetPriceUSD && amount && parseFloat(amount) > 0 && (
              <div className="text-sm text-muted-foreground">
                ≈ ${(parseFloat(amount) * simulation.assetPriceUSD).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Available Collateral Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Deposited {selectedAsset}</span>
              <span className="text-lg font-bold">
                {simulation.currentDepositedAmount.toFixed(assetMetadata.decimals)} {selectedAsset}
              </span>
            </div>
            {hasActiveBorrow && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Max Safe Withdraw (HF ≥ 1.2)</span>
                  <Badge variant="outline" className="text-green-600">
                    {formatUnits(simulation.maxSafeWithdraw, assetMetadata.decimals)} {selectedAsset}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Max Absolute Withdraw (HF ≥ 1.0)</span>
                  <Badge variant="outline" className="text-orange-600">
                    {formatUnits(simulation.maxAbsoluteWithdraw, assetMetadata.decimals)} {selectedAsset}
                  </Badge>
                </div>
              </>
            )}
            {!hasActiveBorrow && (
              <div className="text-xs text-muted-foreground italic">
                No active borrows - you can withdraw all collateral
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Health Factor Preview */}
      {amount && parseFloat(amount) > 0 && simulation.simulatedHealthFactor !== null && hasActiveBorrow && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Health Factor Preview
            </CardTitle>
            <CardDescription>
              Impact on your position after withdrawal
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
                <div className="text-sm text-muted-foreground">After Withdrawal</div>
                <div
                  className={`text-2xl font-bold ${
                    simulation.simulatedHealthFactor === Infinity
                      ? "text-green-600"
                      : simulation.simulatedHealthFactor < 1.0
                      ? "text-red-600"
                      : simulation.simulatedHealthFactor < 1.2
                      ? "text-orange-600"
                      : simulation.simulatedHealthFactor < 1.5
                      ? "text-yellow-600"
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
                    simulation.simulatedHealthFactor === Infinity
                      ? "text-green-600 bg-green-100"
                      : simulation.simulatedHealthFactor < 1.0
                      ? "text-red-600 bg-red-100"
                      : simulation.simulatedHealthFactor < 1.2
                      ? "text-orange-600 bg-orange-100"
                      : simulation.simulatedHealthFactor < 1.5
                      ? "text-yellow-600 bg-yellow-100"
                      : "text-green-600 bg-green-100"
                  }
                >
                  {simulation.simulatedHealthFactor === Infinity
                    ? "No Debt"
                    : simulation.simulatedHealthFactor < 1.0
                    ? "Liquidation Risk!"
                    : simulation.simulatedHealthFactor < 1.2
                    ? "Risky"
                    : simulation.simulatedHealthFactor < 1.5
                    ? "Warning"
                    : "Safe"}
                </Badge>
              </div>
            </div>

            {/* Collateral Amount */}
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Collateral (USD)</span>
                <span className="font-medium">
                  ${simulation.currentCollateralUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">After Withdrawal (USD)</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    ${simulation.currentCollateralUSD.toFixed(2)}
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-bold text-orange-600">
                    ${simulation.newCollateralUSD.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Safety Warnings */}
            {!simulation.isSafe && simulation.isValidAmount && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  <strong>Warning:</strong> Your health factor will be below the safe threshold (1.2).
                  Consider withdrawing less to maintain a safer position.
                </AlertDescription>
              </Alert>
            )}

            {!simulation.isValidAmount && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cannot Withdraw:</strong> This would put your position at risk
                  of liquidation. Health factor must stay above 1.0.
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

      {/* Withdraw Button */}
      <Button
        onClick={handleWithdraw}
        disabled={!canWithdraw}
        className="w-full"
        size="lg"
      >
        {isWithdrawing || isWithdrawPending || isWithdrawConfirming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isWithdrawConfirming ? "Confirming..." : "Withdrawing..."}
          </>
        ) : isWithdrawSuccess ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Success! Redirecting...
          </>
        ) : (
          <>
            Withdraw {amount || "0"} {selectedAsset}
          </>
        )}
      </Button>

      {/* Info Note */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>
          Safe threshold: HF ≥ 1.2 | Minimum: HF ≥ 1.0
        </p>
        {hasActiveBorrow && (
          <p>
            Withdrawing collateral lowers your health factor and increases liquidation risk
          </p>
        )}
      </div>
    </div>
  );
}
