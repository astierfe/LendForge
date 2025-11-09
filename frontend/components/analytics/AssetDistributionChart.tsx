"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, PieLabelRenderProps } from "recharts";
import { useGlobalMetrics } from "@/hooks/useGlobalMetrics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Asset colors matching existing theme
 */
const COLORS = {
  ETH: "#3b82f6", // Blue
  USDC: "#10b981", // Green
  DAI: "#f59e0b", // Yellow/Amber
};

/**
 * Custom label for pie chart
 */
const renderCustomLabel = (props: PieLabelRenderProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

  // Type guard to ensure required properties exist
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number"
  ) {
    return null;
  }

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Only show label if percentage is > 5%
  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-sm font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

/**
 * Custom tooltip for pie chart
 */
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      name: string;
      value: number;
      amount: number;
      percentage: number;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {data.name}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Amount: {data.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {data.name}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Value: ${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Share: {data.percentage.toFixed(1)}%
      </p>
    </div>
  );
};

/**
 * Asset Distribution Chart Component
 *
 * Displays TVL breakdown by asset (ETH/USDC/DAI) as a pie chart.
 * Shows real-time percentages and USD values.
 *
 * Usage:
 * ```tsx
 * <AssetDistributionChart />
 * ```
 */
export function AssetDistributionChart() {
  const { metrics, isLoading, error } = useGlobalMetrics();

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
          Asset Distribution
        </h3>
        <p className="text-sm text-red-600">
          Failed to load asset distribution. Please try again later.
        </p>
      </Card>
    );
  }

  const { tvlByAsset, totalTVL } = metrics;

  // Prepare data for pie chart
  const chartData = [
    {
      name: "ETH",
      value: tvlByAsset.ETH.valueUSD,
      amount: tvlByAsset.ETH.amount,
      percentage: totalTVL > 0 ? (tvlByAsset.ETH.valueUSD / totalTVL) * 100 : 0,
    },
    {
      name: "USDC",
      value: tvlByAsset.USDC.valueUSD,
      amount: tvlByAsset.USDC.amount,
      percentage: totalTVL > 0 ? (tvlByAsset.USDC.valueUSD / totalTVL) * 100 : 0,
    },
    {
      name: "DAI",
      value: tvlByAsset.DAI.valueUSD,
      amount: tvlByAsset.DAI.amount,
      percentage: totalTVL > 0 ? (tvlByAsset.DAI.valueUSD / totalTVL) * 100 : 0,
    },
  ];

  // Filter out assets with 0 value
  const activeData = chartData.filter((item) => item.value > 0);

  if (activeData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Asset Distribution
        </h3>
        <p className="text-sm text-gray-500">
          No assets deposited yet. Start using the protocol to see distribution!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Asset Distribution
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          TVL breakdown by collateral type
        </p>
      </div>

      {/* Pie Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {activeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Asset breakdown table */}
      <div className="mt-6 space-y-3">
        {activeData.map((asset) => (
          <div
            key={asset.name}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[asset.name as keyof typeof COLORS] }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {asset.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {asset.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                ${asset.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {asset.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Total TVL</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            ${totalTVL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </Card>
  );
}
