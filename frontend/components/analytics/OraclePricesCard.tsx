"use client";

import { useOraclePrices } from "@/hooks/useOraclePrices";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

/**
 * Price row component
 */
interface PriceRowProps {
  symbol: string;
  oraclePrice: number;
  coinGeckoPrice?: number;
  deviation?: number;
  hasDeviation: boolean;
  isStablecoin: boolean;
  color: string;
}

function PriceRow({
  symbol,
  oraclePrice,
  coinGeckoPrice,
  deviation,
  hasDeviation,
  isStablecoin,
  color,
}: PriceRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center`}>
          <span className="text-white font-bold text-sm">{symbol.slice(0, 2)}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{symbol}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isStablecoin ? "Stablecoin" : "Volatile Asset"}
          </p>
        </div>
      </div>

      <div className="text-right">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ${oraclePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Oracle Price</p>
          </div>
          {hasDeviation && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {deviation?.toFixed(1)}%
            </Badge>
          )}
        </div>

        {coinGeckoPrice && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            CoinGecko: ${coinGeckoPrice.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Oracle Prices Card Component
 *
 * Displays current oracle prices for all supported assets (ETH, USDC, DAI).
 * Optionally compares with CoinGecko prices and shows deviation warnings.
 *
 * IMPORTANT: On testnet, USDC and DAI are hardcoded to $1.00
 *
 * Usage:
 * ```tsx
 * <OraclePricesCard fetchCoinGecko={true} />
 * ```
 */
export function OraclePricesCard({ fetchCoinGecko = false }: { fetchCoinGecko?: boolean }) {
  const { prices, isLoading, error, refetch } = useOraclePrices({ fetchCoinGecko });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Oracle Prices
        </h3>
        <p className="text-sm text-red-600">
          Failed to load oracle prices: {error}
        </p>
      </Card>
    );
  }

  const hasAnyDeviation = prices.ETH.hasDeviation || prices.USDC.hasDeviation || prices.DAI.hasDeviation;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Oracle Prices</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current on-chain asset prices
          </p>
        </div>
        <button
          onClick={refetch}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Refresh prices"
        >
          <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Testnet Warning */}
      <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
        <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Testnet Note:</strong> USDC and DAI prices are hardcoded to $1.00 (oracle mocks).
          Only ETH price is fetched from Chainlink oracle.
        </AlertDescription>
      </Alert>

      {/* Deviation Warning */}
      {hasAnyDeviation && fetchCoinGecko && (
        <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-500" />
          <AlertDescription className="text-sm text-red-800 dark:text-red-200">
            <strong>Price Deviation Detected:</strong> Oracle price differs from CoinGecko by more than 5%.
            This may indicate a price feed issue.
          </AlertDescription>
        </Alert>
      )}

      {/* Price List */}
      <div className="space-y-3">
        <PriceRow
          symbol="ETH"
          oraclePrice={prices.ETH.oraclePrice}
          coinGeckoPrice={prices.ETH.coinGeckoPrice}
          deviation={prices.ETH.deviation}
          hasDeviation={prices.ETH.hasDeviation}
          isStablecoin={false}
          color="bg-blue-500"
        />

        <PriceRow
          symbol="USDC"
          oraclePrice={prices.USDC.oraclePrice}
          coinGeckoPrice={prices.USDC.coinGeckoPrice}
          deviation={prices.USDC.deviation}
          hasDeviation={prices.USDC.hasDeviation}
          isStablecoin={true}
          color="bg-green-500"
        />

        <PriceRow
          symbol="DAI"
          oraclePrice={prices.DAI.oraclePrice}
          coinGeckoPrice={prices.DAI.coinGeckoPrice}
          deviation={prices.DAI.deviation}
          hasDeviation={prices.DAI.hasDeviation}
          isStablecoin={true}
          color="bg-yellow-500"
        />
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Oracle Active</span>
          </div>
          <a
            href="https://docs.chain.link/data-feeds/price-feeds"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Powered by Chainlink
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Card>
  );
}
