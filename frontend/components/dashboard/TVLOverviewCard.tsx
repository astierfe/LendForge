"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp } from "lucide-react";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";

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

  // Debug: Log to verify this is the new version
  console.log('[TVLOverviewCard] NEW VERSION - User data:', user?.id, 'hasDeposits:', hasDeposits);

  // If no deposits, show empty state
  if (!user || !hasDeposits || user.collaterals.length === 0) {
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

  // Parse total collateral in USD (8 decimals from Chainlink)
  const totalCollateralUSD = formatters.usdToNumber(user.totalCollateralUSD);

  // Calculate ETH price hardcoded at $2500 for now
  const ETH_PRICE = 2500;

  // Build assets array - always show all 3 assets (ETH, USDC, DAI)
  const allAssets = ["ETH", "USDC", "DAI"];
  const assets = allAssets.map((symbol) => {
    // Find collateral for this asset (if exists)
    const collateral = user.collaterals.find(c => c.asset.symbol === symbol);

    // Parse amount (0 if not deposited)
    const amount = collateral
      ? formatters.tokenToNumber(collateral.amount, collateral.asset.decimals, symbol)
      : 0;

    // Calculate USD value
    let valueUSD = 0;
    if (symbol === "ETH") {
      valueUSD = amount * ETH_PRICE;
    } else if (symbol === "USDC" || symbol === "DAI") {
      valueUSD = amount * 1.0; // $1 per stablecoin
    }

    // Calculate percentage
    const percent = totalCollateralUSD > 0 ? (valueUSD / totalCollateralUSD) * 100 : 0;

    // Assign color
    let color = "bg-gray-500";
    if (symbol === "ETH") color = "bg-blue-500";
    else if (symbol === "USDC") color = "bg-green-500";
    else if (symbol === "DAI") color = "bg-yellow-500";

    return {
      name: symbol,
      amount,
      valueUSD,
      percent,
      color,
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
