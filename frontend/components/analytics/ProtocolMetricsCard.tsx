"use client";

import { useGlobalMetrics } from "@/hooks/useGlobalMetrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Activity, Users } from "lucide-react";

/**
 * Metric display component
 */
interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}

function MetricItem({ icon, label, value, subValue, color }: MetricItemProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className={`p-3 ${color} rounded-lg`}>{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subValue && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Protocol Metrics Card Component
 *
 * Displays key protocol metrics:
 * - Total TVL
 * - Total Borrowed
 * - Utilization Rate
 * - Active Positions
 *
 * Usage:
 * ```tsx
 * <ProtocolMetricsCard />
 * ```
 */
export function ProtocolMetricsCard() {
  const { metrics, isLoading, error } = useGlobalMetrics();

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Protocol Metrics
        </h3>
        <p className="text-sm text-red-600">
          Failed to load protocol metrics. Please try again later.
        </p>
      </Card>
    );
  }

  const { totalTVL, totalBorrowed, utilizationRate, activePositions, ethPrice } = metrics;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Protocol Overview</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Real-time protocol statistics
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total TVL */}
        <MetricItem
          icon={<DollarSign className="w-6 h-6 text-white" />}
          label="Total Value Locked"
          value={`$${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subValue={`ETH: $${ethPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          color="bg-blue-500"
        />

        {/* Total Borrowed */}
        <MetricItem
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          label="Total Borrowed"
          value={`$${totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subValue={`${((totalBorrowed / totalTVL) * 100 || 0).toFixed(1)}% of TVL`}
          color="bg-green-500"
        />

        {/* Utilization Rate */}
        <MetricItem
          icon={<Activity className="w-6 h-6 text-white" />}
          label="Utilization Rate"
          value={`${utilizationRate.toFixed(1)}%`}
          subValue={
            utilizationRate < 50
              ? "Healthy"
              : utilizationRate < 75
              ? "Moderate"
              : utilizationRate < 90
              ? "High"
              : "Critical"
          }
          color={
            utilizationRate < 50
              ? "bg-green-500"
              : utilizationRate < 75
              ? "bg-yellow-500"
              : utilizationRate < 90
              ? "bg-orange-500"
              : "bg-red-500"
          }
        />

        {/* Active Positions */}
        <MetricItem
          icon={<Users className="w-6 h-6 text-white" />}
          label="Active Positions"
          value={activePositions.toString()}
          subValue={`${activePositions} user${activePositions !== 1 ? "s" : ""} borrowing`}
          color="bg-purple-500"
        />
      </div>

      {/* Additional Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Available to Borrow</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              ${Math.max(0, totalTVL - totalBorrowed).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Assets</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">3</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">ETH, USDC, DAI</p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Protocol Status</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                Operational
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last updated: {metrics.updatedAt.toLocaleTimeString()}
        </p>
      </div>
    </Card>
  );
}
