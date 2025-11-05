"use client";

import { useState } from "react";
import { useRecentTransactions, TransactionTypeFilter } from "@/hooks/useRecentTransactions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

/**
 * Get badge color based on transaction type
 */
const getTypeBadgeColor = (type: string): string => {
  if (type.includes("Deposit")) return "bg-green-500";
  if (type.includes("Borrow")) return "bg-blue-500";
  if (type.includes("Repay")) return "bg-purple-500";
  if (type.includes("Withdraw")) return "bg-orange-500";
  if (type.includes("Liquidation")) return "bg-red-500";
  return "bg-gray-500";
};

/**
 * Recent Activity Card Component
 *
 * Displays recent protocol transactions (deposits, borrows, repayments).
 * Supports filtering by transaction type.
 *
 * Usage:
 * ```tsx
 * <RecentActivityCard />
 * ```
 */
export function RecentActivityCard() {
  const { transactions, typeFilter, setTypeFilter, isLoading, error } =
    useRecentTransactions({ first: 10 });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Recent Activity
        </h3>
        <p className="text-sm text-red-600">
          Failed to load recent activity. Please try again later.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Activity
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Latest protocol transactions
          </p>
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              typeFilter === "all"
                ? "bg-gray-900 dark:bg-gray-700 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter("deposits")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              typeFilter === "deposits"
                ? "bg-green-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => setTypeFilter("borrows")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              typeFilter === "borrows"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Borrows
          </button>
          <button
            onClick={() => setTypeFilter("repays")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              typeFilter === "repays"
                ? "bg-purple-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Repays
          </button>
          <button
            onClick={() => setTypeFilter("withdrawals")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              typeFilter === "withdrawals"
                ? "bg-orange-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Withdrawals
          </button>
        </div>
      </div>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No transactions found. Start using the protocol to see activity!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Left side - Type and User */}
              <div className="flex items-center gap-4 flex-1">
                <Badge
                  className={`${getTypeBadgeColor(tx.typeLabel)} text-white border-0 min-w-[80px] justify-center`}
                >
                  {tx.typeLabel}
                </Badge>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {tx.amountFormatted}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      by {tx.userAddressTruncated}
                    </p>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tx.timestampLabel}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side - Etherscan link */}
              <a
                href={tx.etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="View on Etherscan"
              >
                <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {transactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {transactions.length} most recent transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
