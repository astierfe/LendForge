"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useUserPosition } from "@/hooks/useUserPosition";

/**
 * HealthFactorDisplay - Visual gauge component for health factor
 *
 * Shows:
 * - Current health factor value (e.g., 15.12)
 * - Risk level indicator (Safe/Warning/Danger/Liquidation)
 * - Circular gauge with color coding
 * - Threshold markers (HF 2.0, 1.5, 1.2, 1.0)
 * - Alert if HF < 1.5
 *
 * Data source: useHealthFactor hook
 */
export function HealthFactorDisplay() {
  const healthFactor = useHealthFactor();

  // Debug log
  console.log('[HealthFactorDisplay] healthFactor:', healthFactor);

  // If no health factor data, show empty state
  // useHealthFactor already returns null when there's no debt (on-chain check)
  if (!healthFactor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Health Factor
          </CardTitle>
          <CardDescription>Your account health indicator</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No health factor available</p>
            <p className="text-xs mt-2">Borrow assets to see your health factor</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate gauge rotation (semi-circle: -90deg to +90deg = 180deg total)
  // HF 0 → -90deg (left), HF 3+ → +90deg (right)
  const maxHF = 3; // Cap at 3 for display purposes
  const cappedHF = Math.min(healthFactor.value, maxHF);
  const rotation = -90 + (cappedHF / maxHF) * 180;

  // Determine icon based on level
  const Icon = healthFactor.level === "safe" || healthFactor.level === "warning"
    ? ShieldCheck
    : AlertTriangle;

  // Color mapping for gauge
  const gaugeColors = {
    safe: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-orange-600",
    liquidation: "text-red-600"
  };

  const bgColors = {
    safe: "bg-green-50",
    warning: "bg-yellow-50",
    danger: "bg-orange-50",
    liquidation: "bg-red-50"
  };

  const borderColors = {
    safe: "border-green-200",
    warning: "border-yellow-200",
    danger: "border-orange-200",
    liquidation: "border-red-200"
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Health Factor
        </CardTitle>
        <CardDescription>Your account health indicator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circular Gauge */}
        <div className="flex flex-col items-center">
          {/* Gauge Container */}
          <div className="relative w-64 h-36">
            {/* Background Arc (gray) */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet">
              {/* Gray background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="20"
                strokeLinecap="round"
              />

              {/* Colored arc based on health factor */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={
                  healthFactor.level === "safe" ? "#16a34a" :
                  healthFactor.level === "warning" ? "#ca8a04" :
                  healthFactor.level === "danger" ? "#ea580c" :
                  "#dc2626"
                }
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${(cappedHF / maxHF) * 251.2} 251.2`}
              />

              {/* Threshold markers on the arc */}
              {/* HF = 1.0 (left edge, angle = 180°) */}
              <circle cx="20" cy="100" r="5" fill="#dc2626" />
              {/* HF = 1.2 (angle ≈ 156°) */}
              <circle cx="40" cy="63" r="5" fill="#ea580c" />
              {/* HF = 1.5 (angle ≈ 120°) */}
              <circle cx="80" cy="36" r="5" fill="#ca8a04" />
              {/* HF = 2.0 (angle ≈ 60°) */}
              <circle cx="140" cy="36" r="5" fill="#16a34a" />
              {/* HF = 3.0+ (right edge, angle = 0°) */}
              <circle cx="180" cy="100" r="5" fill="#16a34a" />

              {/* Needle */}
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="30"
                stroke="#1f2937"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ transformOrigin: '100px 100px', transform: `rotate(${rotation}deg)` }}
              />
              <circle cx="100" cy="100" r="6" fill="#1f2937" />
            </svg>

            {/* Threshold labels */}
            <div className="absolute bottom-2 left-0 text-xs text-gray-500">1.0</div>
            <div className="absolute bottom-2 right-0 text-xs text-gray-500">3.0+</div>
          </div>

          {/* Health Factor Value */}
          <div className="text-center mt-4">
            <p className="text-5xl font-bold">{healthFactor.value.toFixed(2)}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Icon className={`w-5 h-5 ${gaugeColors[healthFactor.level]}`} />
              <span className={`text-lg font-semibold ${gaugeColors[healthFactor.level]}`}>
                {healthFactor.label}
              </span>
            </div>
          </div>
        </div>

        {/* Risk Level Explanation */}
        <div className={`p-4 rounded-lg border ${bgColors[healthFactor.level]} ${borderColors[healthFactor.level]}`}>
          <div className="flex items-start gap-2">
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${gaugeColors[healthFactor.level]}`} />
            <div className="text-sm">
              {healthFactor.level === "safe" && (
                <>
                  <p className="font-medium text-green-900">Your account is healthy</p>
                  <p className="text-green-700 mt-1">You can safely borrow more assets. Your health factor is well above the liquidation threshold.</p>
                </>
              )}
              {healthFactor.level === "warning" && (
                <>
                  <p className="font-medium text-yellow-900">Moderate risk level</p>
                  <p className="text-yellow-700 mt-1">Your health factor is approaching the danger zone. Consider depositing more collateral or repaying some debt.</p>
                </>
              )}
              {healthFactor.level === "danger" && (
                <>
                  <p className="font-medium text-orange-900">High risk - Action recommended</p>
                  <p className="text-orange-700 mt-1">Your position is at risk. Deposit more collateral or repay debt immediately to avoid liquidation.</p>
                </>
              )}
              {healthFactor.level === "liquidation" && (
                <>
                  <p className="font-medium text-red-900">Critical - Liquidation risk!</p>
                  <p className="text-red-700 mt-1">Your position may be liquidated at any time. Take immediate action to improve your health factor.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Threshold Reference */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-sm mb-3">Health Factor Thresholds</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span>Safe: ≥ 2.0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
              <span>Warning: 1.5 - 2.0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-600"></div>
              <span>Danger: 1.2 - 1.5</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span>Liquidation: &lt; 1.2</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
