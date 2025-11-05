"use client";

import { useRecentLiquidations } from "@/hooks/useRecentLiquidations";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, AlertTriangle } from "lucide-react";

/**
 * Liquidations History Card Component
 *
 * Displays recent liquidation events with filtering by asset and time period.
 * Shows user address, liquidator, debt repaid, collateral seized, and transaction details.
 *
 * Usage:
 * ```tsx
 * <LiquidationsHistoryCard />
 * ```
 */
export function LiquidationsHistoryCard() {
  const {
    liquidations,
    timeFilter,
    setTimeFilter,
    isLoading,
    error,
  } = useRecentLiquidations({ first: 10 });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Liquidations History
        </h3>
        <p className="text-sm text-red-600">
          Failed to load liquidations. Please try again later.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header with filters */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Liquidations History
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Recent liquidation events across the protocol
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Time filter */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Period</p>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeFilter("7d")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeFilter === "7d"
                  ? "bg-gray-900 dark:bg-gray-700 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeFilter("30d")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeFilter === "30d"
                  ? "bg-gray-900 dark:bg-gray-700 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeFilter === "all"
                  ? "bg-gray-900 dark:bg-gray-700 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Liquidations list */}
      {liquidations.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No liquidations found for the selected filters.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            This is good news - it means users are maintaining healthy positions!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liquidations.map((liq) => (
            <div
              key={liq.id}
              className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 rounded-lg p-4 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left side - Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {liq.timestampLabel}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">User</p>
                      <p className="font-mono text-gray-900 dark:text-white">
                        {liq.userAddressTruncated}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Liquidator</p>
                      <p className="font-mono text-gray-900 dark:text-white">
                        {liq.liquidatorAddressTruncated}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Debt Repaid</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        ${liq.debtRepaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Collateral Seized</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        ${liq.collateralSeizedUSD.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right side - Etherscan link */}
                <a
                  href={liq.etherscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-colors flex-shrink-0"
                  title="View on Etherscan"
                >
                  <ExternalLink className="w-4 h-4 text-red-600 dark:text-red-400" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {liquidations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <p>
              Showing {liquidations.length} liquidation{liquidations.length !== 1 ? "s" : ""}
            </p>
            <p>Filtered by: {timeFilter.toUpperCase()}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
