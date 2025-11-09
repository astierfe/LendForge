"use client";

import { useState } from "react";
import { useOraclePrices } from "@/hooks/useOraclePrices";
import { usePriceProviders } from "@/hooks/usePriceProviders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * OracleControlPanel Component
 *
 * Admin panel to modify oracle prices for USDC and DAI
 * ETH price is read-only (Chainlink oracle)
 *
 * Features:
 * - Display current oracle prices for ETH, USDC, DAI
 * - Update USDC/DAI prices via ManualPriceProvider
 * - ETH input disabled (Chainlink read-only)
 * - Quick preset buttons for testing scenarios
 */
export function OracleControlPanel() {
  const { prices, isLoading: pricesLoading, refetch } = useOraclePrices();
  const {
    setUSDCPrice,
    setDAIPrice,
    isPending,
    error,
    transactionHash,
  } = usePriceProviders();

  const [usdcInput, setUsdcInput] = useState("");
  const [daiInput, setDaiInput] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUSDCUpdate = async () => {
    const price = parseFloat(usdcInput);
    if (isNaN(price) || price <= 0) {
      return;
    }

    setSuccessMessage(null);
    await setUSDCPrice(price);

    if (!error) {
      setSuccessMessage(`USDC price updated to $${price.toFixed(2)}`);
      setUsdcInput("");
      // Refresh oracle prices after 2 seconds (allow time for blockchain confirmation)
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  };

  const handleDAIUpdate = async () => {
    const price = parseFloat(daiInput);
    if (isNaN(price) || price <= 0) {
      return;
    }

    setSuccessMessage(null);
    await setDAIPrice(price);

    if (!error) {
      setSuccessMessage(`DAI price updated to $${price.toFixed(2)}`);
      setDaiInput("");
      // Refresh oracle prices after 2 seconds
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  };

  // Quick preset actions
  const handleResetStablecoins = async () => {
    setSuccessMessage(null);
    await setUSDCPrice(1.0);
    await setDAIPrice(1.0);

    if (!error) {
      setSuccessMessage("Stablecoins reset to $1.00");
      setUsdcInput("");
      setDaiInput("");
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  };

  const handleUSDCDepeg = async () => {
    setSuccessMessage(null);
    await setUSDCPrice(0.95);

    if (!error) {
      setSuccessMessage("USDC depeg scenario activated ($0.95)");
      setUsdcInput("");
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Oracle Price Management
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={pricesLoading}
            className="h-6 w-6"
          >
            <RefreshCw className={`h-4 w-4 ${pricesLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Modify oracle prices for testing scenarios (USDC/DAI only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-green-500 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {transactionHash && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Transaction:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-600"
              >
                {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Prices Display */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <Label className="text-sm text-muted-foreground">ETH Price</Label>
            <div className="mt-1 text-2xl font-bold">
              {pricesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `$${prices.ETH.oraclePrice.toFixed(2)}`
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Chainlink (read-only)</p>
          </div>

          <div className="rounded-lg border p-4">
            <Label className="text-sm text-muted-foreground">USDC Price</Label>
            <div className="mt-1 text-2xl font-bold">
              {pricesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `$${prices.USDC.oraclePrice.toFixed(2)}`
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">ManualPriceProvider</p>
          </div>

          <div className="rounded-lg border p-4">
            <Label className="text-sm text-muted-foreground">DAI Price</Label>
            <div className="mt-1 text-2xl font-bold">
              {pricesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `$${prices.DAI.oraclePrice.toFixed(2)}`
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">ManualPriceProvider</p>
          </div>
        </div>

        {/* Price Update Controls */}
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">Update Prices</h3>

          {/* ETH Price (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="eth-price" className="text-muted-foreground">
              ETH Price (USD)
            </Label>
            <div className="flex gap-2">
              <Input
                id="eth-price"
                type="number"
                placeholder="Read-only"
                value={prices.ETH.oraclePrice.toFixed(2)}
                disabled
                className="bg-muted"
              />
              <Button disabled variant="secondary" className="min-w-24">
                Update
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              ETH uses Chainlink oracle (cannot be modified via admin panel)
            </p>
          </div>

          {/* USDC Price */}
          <div className="space-y-2">
            <Label htmlFor="usdc-price">USDC Price (USD)</Label>
            <div className="flex gap-2">
              <Input
                id="usdc-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter price (e.g., 1.00)"
                value={usdcInput}
                onChange={(e) => setUsdcInput(e.target.value)}
                disabled={isPending}
              />
              <Button
                onClick={handleUSDCUpdate}
                disabled={isPending || !usdcInput || parseFloat(usdcInput) <= 0}
                className="min-w-24"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </div>

          {/* DAI Price */}
          <div className="space-y-2">
            <Label htmlFor="dai-price">DAI Price (USD)</Label>
            <div className="flex gap-2">
              <Input
                id="dai-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter price (e.g., 1.00)"
                value={daiInput}
                onChange={(e) => setDaiInput(e.target.value)}
                disabled={isPending}
              />
              <Button
                onClick={handleDAIUpdate}
                disabled={isPending || !daiInput || parseFloat(daiInput) <= 0}
                className="min-w-24"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Preset Actions */}
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Quick Presets</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleResetStablecoins}
              disabled={isPending}
            >
              Reset to $1.00
            </Button>
            <Button
              variant="outline"
              onClick={handleUSDCDepeg}
              disabled={isPending}
            >
              USDC Depeg ($0.95)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Presets for common testing scenarios
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
