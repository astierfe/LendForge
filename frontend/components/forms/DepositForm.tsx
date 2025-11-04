"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, parseUnits, formatUnits } from "viem";
import { AssetSelector, SupportedAsset } from "./AssetSelector";
import { AmountInput } from "./AmountInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { CONTRACTS, TOKENS, ASSET_METADATA } from "@/lib/contracts/addresses";
import { LTV_RATIOS } from "@/lib/contracts/config";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Import ABIs
import ERC20ABI from "@/lib/contracts/abis/ERC20.json";
import CollateralManagerABI from "@/lib/contracts/abis/CollateralManager.json";

// Maximum uint256 for approvals
const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

interface DepositPreview {
  currentCollateralUSD: number;
  newCollateralUSD: number;
  newMaxBorrowable: number;
  depositValueUSD: number;
}

export function DepositForm() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("ETH");
  const [amount, setAmount] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // User position data
  const { data: userPosition, refetch: refetchUserPosition } = useUserPosition();

  // Get token address
  const tokenAddress = TOKENS[selectedAsset];
  const isEth = selectedAsset === "ETH";
  const decimals = ASSET_METADATA[tokenAddress].decimals;

  // Get balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  const { data: erc20Balance } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI.abi,
    functionName: "balanceOf",
    args: [address],
    query: {
      enabled: !isEth && !!address,
    },
  });

  // Get allowance for ERC20 (approve to CollateralManager)
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20ABI.abi,
    functionName: "allowance",
    args: [address, CONTRACTS.COLLATERAL_MANAGER],
    query: {
      enabled: !isEth && !!address,
    },
  });

  // Get ETH price (mock for now - you'll need oracle integration)
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
    args: [tokenAddress],
  });

  // Wagmi write hooks
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositPending,
  } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Wait for deposit transaction
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({
      hash: depositHash,
    });

  // Calculate balance
  const balance = useMemo(() => {
    if (isEth && ethBalance) {
      return formatUnits(ethBalance.value, 18);
    }
    if (!isEth && erc20Balance) {
      return formatUnits(erc20Balance as bigint, decimals);
    }
    return "0";
  }, [isEth, ethBalance, erc20Balance, decimals]);

  // Calculate price in USD
  const priceUSD = useMemo(() => {
    if (!ethPrice) return "0";
    // Oracle returns price with 8 decimals (Chainlink format)
    return formatUnits(ethPrice as bigint, 8);
  }, [ethPrice]);

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (isEth || !amount || amount === "0") return false;
    if (!allowance) return true;

    const amountBigInt = parseUnits(amount, decimals);
    return (allowance as bigint) < amountBigInt;
  }, [isEth, amount, allowance, decimals]);

  // Calculate deposit preview
  const preview = useMemo((): DepositPreview | null => {
    if (!amount || !priceUSD || parseFloat(amount) === 0) return null;

    const depositAmount = parseFloat(amount);
    const price = parseFloat(priceUSD);
    const depositValueUSD = depositAmount * price;

    const currentCollateralUSD = userPosition
      ? formatters.usdToNumber(userPosition.totalCollateralUSD)
      : 0;

    const newCollateralUSD = currentCollateralUSD + depositValueUSD;

    // Calculate max borrowable based on LTV
    const ltv = LTV_RATIOS[selectedAsset];
    const newMaxBorrowable = newCollateralUSD * ltv;

    return {
      currentCollateralUSD,
      newCollateralUSD,
      newMaxBorrowable,
      depositValueUSD,
    };
  }, [amount, priceUSD, selectedAsset, userPosition]);

  // Handle approval success
  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApproving(false);
      refetchAllowance();
      toast({
        title: "Approval Successful",
        description: `${selectedAsset} approved for deposit`,
      });
    }
  }, [isApprovalSuccess, selectedAsset, toast, refetchAllowance]);

  // Handle deposit success
  useEffect(() => {
    if (isDepositSuccess) {
      setIsDepositing(false);

      // Refetch user position to update dashboard
      setTimeout(() => {
        refetchUserPosition();
      }, 2000); // Wait 2s for subgraph to index

      toast({
        title: "Deposit Successful",
        description: `Successfully deposited ${amount} ${selectedAsset}`,
      });

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }
  }, [isDepositSuccess, amount, selectedAsset, toast, router, refetchUserPosition]);

  // Handle approve button click
  const handleApprove = async () => {
    if (!address) return;

    setIsApproving(true);
    try {
      approve({
        address: tokenAddress,
        abi: ERC20ABI.abi,
        functionName: "approve",
        args: [CONTRACTS.COLLATERAL_MANAGER, MAX_UINT256],
      });
    } catch (error) {
      console.error("Approval error:", error);
      setIsApproving(false);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle deposit button click
  const handleDeposit = async () => {
    if (!address || !amount) return;

    setIsDepositing(true);
    try {
      if (isEth) {
        // ETH deposit via CollateralManager
        deposit({
          address: CONTRACTS.COLLATERAL_MANAGER,
          abi: CollateralManagerABI.abi,
          functionName: "depositETH",
          value: parseEther(amount),
        });
      } else {
        // ERC20 deposit via CollateralManager
        deposit({
          address: CONTRACTS.COLLATERAL_MANAGER,
          abi: CollateralManagerABI.abi,
          functionName: "depositERC20",
          args: [tokenAddress, parseUnits(amount, decimals)],
        });
      }
    } catch (error) {
      console.error("Deposit error:", error);
      setIsDepositing(false);
      toast({
        variant: "destructive",
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Validation
  const canDeposit =
    isConnected &&
    amount &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(balance) &&
    !needsApproval &&
    !isDepositing &&
    !isDepositPending &&
    !isDepositConfirming;

  const canApprove =
    isConnected &&
    !isEth &&
    needsApproval &&
    amount &&
    parseFloat(amount) > 0 &&
    !isApproving &&
    !isApprovePending &&
    !isApprovalConfirming;

  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to deposit collateral
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Asset</CardTitle>
          <CardDescription>Choose the asset you want to deposit</CardDescription>
        </CardHeader>
        <CardContent>
          <AssetSelector
            selectedAsset={selectedAsset}
            onAssetChange={setSelectedAsset}
            balance={balance}
            price={priceUSD}
          />
        </CardContent>
      </Card>

      {/* Amount Input */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Amount</CardTitle>
          <CardDescription>Enter the amount to deposit</CardDescription>
        </CardHeader>
        <CardContent>
          <AmountInput
            asset={selectedAsset}
            amount={amount}
            balance={balance}
            price={priceUSD}
            onAmountChange={setAmount}
            label="Amount to Deposit"
          />
        </CardContent>
      </Card>

      {/* Deposit Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit Preview</CardTitle>
            <CardDescription>
              Impact on your position after deposit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Deposit Value</div>
                <div className="text-2xl font-bold">
                  ${preview.depositValueUSD.toFixed(2)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">New Max Borrowable</div>
                <div className="text-2xl font-bold text-primary">
                  ${preview.newMaxBorrowable.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Collateral</span>
                <span className="font-medium">
                  ${preview.currentCollateralUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">New Collateral</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    ${preview.currentCollateralUSD.toFixed(2)}
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-bold text-primary">
                    ${preview.newCollateralUSD.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">LTV Ratio</span>
                <Badge variant="outline">
                  {(LTV_RATIOS[selectedAsset] * 100).toFixed(0)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!isEth && needsApproval && (
          <Button
            onClick={handleApprove}
            disabled={!canApprove}
            className="w-full"
            size="lg"
          >
            {isApproving || isApprovePending || isApprovalConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isApprovalConfirming ? "Confirming..." : "Approving..."}
              </>
            ) : (
              <>
                Approve {selectedAsset}
              </>
            )}
          </Button>
        )}

        <Button
          onClick={handleDeposit}
          disabled={!canDeposit}
          className="w-full"
          size="lg"
        >
          {isDepositing || isDepositPending || isDepositConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isDepositConfirming ? "Confirming..." : "Depositing..."}
            </>
          ) : isDepositSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Success! Redirecting...
            </>
          ) : (
            <>
              Deposit {selectedAsset}
            </>
          )}
        </Button>
      </div>

      {/* Status Messages */}
      {needsApproval && !isEth && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to approve {selectedAsset} before depositing. This is a one-time transaction.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
