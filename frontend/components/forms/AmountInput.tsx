"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SupportedAsset } from "./AssetSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AmountInputProps {
  asset: SupportedAsset;
  amount: string;
  balance: string;
  price?: string;
  onAmountChange: (amount: string) => void;
  error?: string;
  label?: string;
}

export function AmountInput({
  asset,
  amount,
  balance,
  price,
  onAmountChange,
  error,
  label = "Amount",
}: AmountInputProps) {
  // Handle MAX button click
  const handleMaxClick = () => {
    onAmountChange(balance);
  };

  // Handle input change - only allow valid numbers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string
    if (value === "") {
      onAmountChange("");
      return;
    }

    // Allow only numbers and one decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  // Calculate USD value
  const calculateUsdValue = (): string => {
    if (!price || !amount || amount === "" || parseFloat(amount) === 0) {
      return "0.00";
    }
    const usdValue = parseFloat(amount) * parseFloat(price);
    return usdValue.toFixed(2);
  };

  // Validate amount
  const validateAmount = (): string | undefined => {
    if (!amount || amount === "") return undefined;

    const numAmount = parseFloat(amount);
    const numBalance = parseFloat(balance);

    if (isNaN(numAmount)) {
      return "Invalid amount";
    }

    if (numAmount <= 0) {
      return "Amount must be greater than 0";
    }

    if (numAmount > numBalance) {
      return "Insufficient balance";
    }

    return undefined;
  };

  const validationError = error || validateAmount();

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">{label}</label>
          <span className="text-xs text-muted-foreground">
            Balance: {parseFloat(balance).toFixed(asset === "USDC" ? 2 : 4)} {asset}
          </span>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={handleInputChange}
              className={validationError ? "border-destructive" : ""}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              {asset}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleMaxClick}
            className="px-6"
          >
            MAX
          </Button>
        </div>
      </div>

      {/* USD Value Display */}
      {price && amount && parseFloat(amount) > 0 && (
        <div className="flex justify-between items-center text-sm px-1">
          <span className="text-muted-foreground">USD Value</span>
          <span className="font-medium">${calculateUsdValue()}</span>
        </div>
      )}

      {/* Error Display */}
      {validationError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {validationError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
