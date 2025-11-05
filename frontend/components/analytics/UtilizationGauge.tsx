"use client";

import { useGlobalMetrics } from "@/hooks/useGlobalMetrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Get color based on utilization rate
 */
const getUtilizationColor = (rate: number): string => {
  if (rate < 50) return "bg-green-500";
  if (rate < 75) return "bg-yellow-500";
  if (rate < 90) return "bg-orange-500";
  return "bg-red-500";
};

/**
 * Get text color based on utilization rate
 */
const getUtilizationTextColor = (rate: number): string => {
  if (rate < 50) return "text-green-600 dark:text-green-400";
  if (rate < 75) return "text-yellow-600 dark:text-yellow-400";
  if (rate < 90) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

/**
 * Get status label based on utilization rate
 */
const getUtilizationStatus = (rate: number): string => {
  if (rate < 50) return "Healthy";
  if (rate < 75) return "Moderate";
  if (rate < 90) return "High";
  return "Critical";
};

/**
 * Utilization Gauge Component
 *
 * Displays borrow utilization rate as a progress bar with color-coded status.
 * Shows the ratio of Total Borrowed / Total TVL as a percentage.
 *
 * Usage:
 * ```tsx
 * <UtilizationGauge />
 * ```
 */
export function UtilizationGauge() {
  const { metrics, isLoading, error } = useGlobalMetrics();

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Borrow Utilization
        </h3>
        <p className="text-sm text-red-600">
          Failed to load utilization data. Please try again later.
        </p>
      </Card>
    );
  }

  const { utilizationRate, totalTVL, totalBorrowed } = metrics;

  // Cap utilization at 100% for display
  const displayRate = Math.min(utilizationRate, 100);

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Borrow Utilization
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Total Borrowed / Total TVL
        </p>
      </div>

      {/* Main utilization display */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <span className={`text-4xl font-bold ${getUtilizationTextColor(displayRate)}`}>
            {displayRate.toFixed(1)}%
          </span>
          <span
            className={`text-sm font-medium px-3 py-1 rounded-full ${
              getUtilizationColor(displayRate)
            } text-white`}
          >
            {getUtilizationStatus(displayRate)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full ${getUtilizationColor(displayRate)} transition-all duration-500 ease-out`}
            style={{ width: `${displayRate}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total TVL</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            ${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">Total Borrowed</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            ${totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">Available to Borrow</span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            ${Math.max(0, totalTVL - totalBorrowed).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
      </div>

      {/* Utilization guide */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Utilization Guide:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">&lt;50% - Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">50-75% - Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">75-90% - High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600 dark:text-gray-400">&gt;90% - Critical</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
