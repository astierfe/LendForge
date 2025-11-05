"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useDailyMetrics, TimePeriod } from "@/hooks/useDailyMetrics";
import { useGlobalMetrics } from "@/hooks/useGlobalMetrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Custom tooltip for chart
 */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {label}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          TVL: ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
};

/**
 * TVL Chart Component
 *
 * Displays historical Total Value Locked (TVL) over time.
 * Supports period filtering (7d/30d) and responsive design.
 *
 * Usage:
 * ```tsx
 * <TVLChart />
 * ```
 */
export function TVLChart() {
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [chartType, setChartType] = useState<"line" | "area">("area");

  // Fetch ETH price from global metrics (ANO_005 workaround)
  const { metrics: globalMetrics } = useGlobalMetrics();
  const { metrics, isLoading, error } = useDailyMetrics(period, globalMetrics.ethPrice);

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          TVL History
        </h3>
        <p className="text-sm text-red-600">
          Failed to load TVL data. Please try again later.
        </p>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          TVL History
        </h3>
        <p className="text-sm text-gray-500">
          No TVL data available yet. Start using the protocol to see charts!
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
            Total Value Locked (TVL)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Historical TVL over time
          </p>
        </div>

        <div className="flex gap-2">
          {/* Period filter */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setPeriod("7d")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === "7d"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setPeriod("30d")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === "30d"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              30D
            </button>
          </div>

          {/* Chart type toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setChartType("line")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                chartType === "line"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setChartType("area")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                chartType === "area"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Area
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        {chartType === "area" ? (
          <AreaChart data={metrics}>
            <defs>
              <linearGradient id="colorTVL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="dateLabel"
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: "currentColor" }}
            />
            <YAxis
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: "currentColor" }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorTVL)"
            />
          </AreaChart>
        ) : (
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="dateLabel"
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: "currentColor" }}
            />
            <YAxis
              className="text-xs text-gray-600 dark:text-gray-400"
              tick={{ fill: "currentColor" }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="tvl"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current TVL</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${metrics[metrics.length - 1]?.tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Utilization</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {(
              metrics.reduce((acc, m) => acc + m.utilizationRate, 0) / metrics.length
            ).toFixed(1)}%
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Data Points</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {metrics.length} days
          </p>
        </div>
      </div>
    </Card>
  );
}
