"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp } from "lucide-react";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import { useOraclePrices } from "@/hooks/useOraclePrices";
import { useCollateralAmounts } from "@/hooks/useCollateralAmounts";
import { TOKENS } from "@/lib/contracts/addresses";

/**
 * TVLOverviewCard - Displays user's collateral with asset breakdown
 *
 * Shows:
 * - Total Collateral Value (USD)
 * - Breakdown by asset (ETH, USDC, DAI)
 * - Percentage distribution
 *
 * Data source: useUserPosition hook (user-specific data from subgraph)
 */
export function TVLOverviewCard() {
  const { data: user, hasDeposits } = useUserPosition();
  const { prices, isLoading: isPricesLoading } = useOraclePrices();

  // Read collateral amounts on-chain (real-time)
  const { collaterals: onChainCollaterals, isLoading: collateralsLoading } = useCollateralAmounts();

  // Debug: Log to verify this is the new version with on-chain data
  console.log('[TVLOverviewCard] ON-CHAIN VERSION - Collaterals:', onChainCollaterals, 'Prices:', prices);

  // If no deposits, show empty state
  const hasCollateral = onChainCollaterals.length > 0;
  if (!hasCollateral && !collateralsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Your Collateral
          </CardTitle>
          <CardDescription>Your deposited assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No collateral deposited yet</p>
            <p className="text-xs mt-2">Deposit assets to start using the protocol</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use real-time prices from OracleAggregator (via useOraclePrices)
  const ETH_PRICE = prices.ETH.oraclePrice || 1600;
  const USDC_PRICE = prices.USDC.oraclePrice || 1.0;
  const DAI_PRICE = prices.DAI.oraclePrice || 1.0;

  // Map on-chain collateral addresses to symbols and decimals
  const assetMap: Record<string, { symbol: string; decimals: number; price: number; color: string }> = {
    [TOKENS.ETH.toLowerCase()]: { symbol: "ETH", decimals: 18, price: ETH_PRICE, color: "bg-blue-500" },
    [TOKENS.USDC.toLowerCase()]: { symbol: "USDC", decimals: 6, price: USDC_PRICE, color: "bg-green-500" },
    [TOKENS.DAI.toLowerCase()]: { symbol: "DAI", decimals: 18, price: DAI_PRICE, color: "bg-yellow-500" },
  };

  // Convert on-chain collaterals to display format with real-time USD values
  const assetsWithValues = onChainCollaterals.map((col) => {
    const assetInfo = assetMap[col.address.toLowerCase()];
    if (!assetInfo) {
      console.warn('[TVLOverviewCard] Unknown asset:', col.address);
      return null;
    }

    const amount = Number(col.amount) / Math.pow(10, assetInfo.decimals);
    const valueUSD = amount * assetInfo.price;

    return {
      name: assetInfo.symbol,
      amount,
      valueUSD,
      color: assetInfo.color,
    };
  }).filter((a) => a !== null);

  // Calculate total collateral in USD (real-time)
  const totalCollateralUSD = assetsWithValues.reduce((sum, asset) => sum + (asset?.valueUSD || 0), 0);

  // Always show all 3 assets (ETH, USDC, DAI) even if balance is 0
  const allAssets = ["ETH", "USDC", "DAI"];
  const assets = allAssets.map((symbol) => {
    const existing = assetsWithValues.find((a) => a?.name === symbol);
    if (existing) {
      return {
        ...existing,
        percent: totalCollateralUSD > 0 ? (existing.valueUSD / totalCollateralUSD) * 100 : 0,
      };
    }

    // Asset not deposited - show as 0
    const assetInfo = Object.values(assetMap).find((a) => a.symbol === symbol);
    return {
      name: symbol,
      amount: 0,
      valueUSD: 0,
      percent: 0,
      color: assetInfo?.color || "bg-gray-500",
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Your Collateral
        </CardTitle>
        <CardDescription>Your deposited assets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Collateral */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Total Collateral</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold">
              ${totalCollateralUSD.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
        </div>

        {/* Asset Breakdown */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Asset Breakdown</p>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
            {assets.map((asset) => (
              <div
                key={asset.name}
                className={asset.color}
                style={{ width: `${asset.percent}%` }}
                title={`${asset.name}: ${asset.percent.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Asset Details */}
          <div className="space-y-2">
            {assets.map((asset) => {
              // Use appropriate decimal places based on asset type
              const decimalsToShow = asset.name === "ETH" ? 4 : 2;

              return (
                <div
                  key={asset.name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${asset.color}`} />
                    <div>
                      <p className="font-medium text-sm">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {asset.amount.toLocaleString('en-US', {
                          minimumFractionDigits: decimalsToShow,
                          maximumFractionDigits: decimalsToShow
                        })} {asset.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      ${asset.valueUSD.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {asset.percent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
