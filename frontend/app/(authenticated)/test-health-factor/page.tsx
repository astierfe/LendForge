"use client";

import { useUserPosition } from "@/hooks/useUserPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { HealthFactorDisplay } from "@/components/dashboard/HealthFactorDisplay";
import { useAccount } from "wagmi";

/**
 * Test page for HealthFactorDisplay component
 *
 * Tests visual gauge display of health factor:
 * - DEPLOYER (0xf350...): HF 15.12 (Safe) - gauge points right
 * - USER (0x5056...): HF 1.80 (Warning) - gauge points slightly left of center
 * - Fresh wallet: No health factor (empty state)
 *
 * Visual Elements:
 * - Semi-circular gauge with color coding
 * - Needle pointing to current HF value
 * - Threshold markers (1.0, 1.2, 1.5, 2.0, 3.0)
 * - Risk level explanation
 * - Alert based on HF level
 */
export default function TestHealthFactorPage() {
  const { address, isConnected } = useAccount();
  const position = useUserPosition();
  const healthFactor = useHealthFactor();

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-4">HealthFactorDisplay Test</h1>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Connected:</strong> {isConnected ? "✅" : "❌"}
          </p>
          <p>
            <strong>Address:</strong>{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              {address || "Not connected"}
            </code>
          </p>
          <p>
            <strong>Expected Profiles:</strong>
          </p>
          <ul className="list-disc ml-6 text-xs text-gray-600">
            <li>
              0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01 - HF 15.12 (Safe, gauge
              points far right)
            </li>
            <li>
              0x5056AB0F67695F3af9F828a1cFccF1daa1b671c3 - HF 1.80 (Warning,
              gauge in middle)
            </li>
            <li>Fresh wallet - No health factor (empty state)</li>
          </ul>
        </div>
      </div>

      {/* Component Under Test */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">HealthFactorDisplay Component</h2>
        <HealthFactorDisplay />
      </div>

      {/* Test State Display */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Test State Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Position State */}
          <div className="bg-green-50 p-4 rounded">
            <h3 className="font-semibold mb-2">User Position State</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <strong>hasPosition:</strong>{" "}
                {position.hasPosition ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
              <li>
                <strong>hasDeposits:</strong>{" "}
                {position.hasDeposits ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
              <li>
                <strong>hasActiveBorrow:</strong>{" "}
                {position.hasActiveBorrow ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
            </ul>
          </div>

          {/* Health Factor State */}
          <div className="bg-purple-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Health Factor State</h3>
            {healthFactor ? (
              <ul className="space-y-1 text-sm">
                <li>
                  <strong>Value:</strong> {healthFactor.value.toFixed(2)}
                </li>
                <li>
                  <strong>Level:</strong>{" "}
                  <span
                    className={`font-bold ${
                      healthFactor.level === "safe"
                        ? "text-green-600"
                        : healthFactor.level === "warning"
                        ? "text-yellow-600"
                        : healthFactor.level === "danger"
                        ? "text-orange-600"
                        : "text-red-600"
                    }`}
                  >
                    {healthFactor.level.toUpperCase()}
                  </span>
                </li>
                <li>
                  <strong>Label:</strong> {healthFactor.label}
                </li>
                <li>
                  <strong>Can Borrow:</strong>{" "}
                  {healthFactor.canBorrow ? (
                    <span className="text-green-600 font-bold">✅ Yes</span>
                  ) : (
                    <span className="text-red-600 font-bold">❌ No</span>
                  )}
                </li>
                <li>
                  <strong>Percentage (for gauge):</strong>{" "}
                  {healthFactor.percentage.toFixed(1)}%
                </li>
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">
                No health factor (no active borrow)
              </p>
            )}
          </div>
        </div>

        {/* Visual Guidelines */}
        <div className="mt-6 bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold mb-2">Visual Guidelines</h3>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Gauge Behavior:</strong>
            </p>
            <ul className="list-disc ml-6 text-xs">
              <li>
                <strong>HF 1.0:</strong> Needle points left (liquidation risk)
              </li>
              <li>
                <strong>HF 1.5:</strong> Needle at ~45° left of center (danger
                zone)
              </li>
              <li>
                <strong>HF 2.0:</strong> Needle at center or slightly right
                (warning threshold)
              </li>
              <li>
                <strong>HF 3.0+:</strong> Needle points far right (safe)
              </li>
            </ul>
          </div>
        </div>

        {/* Threshold Markers */}
        {healthFactor && (
          <div className="mt-6 bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Threshold Analysis</h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span>Current HF:</span>
                <span className="font-bold">{healthFactor.value.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Distance to Danger (1.5):</span>
                <span
                  className={
                    healthFactor.value >= 1.5 ? "text-green-600" : "text-red-600"
                  }
                >
                  {(healthFactor.value - 1.5).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Distance to Liquidation (1.2):</span>
                <span
                  className={
                    healthFactor.value >= 1.2 ? "text-green-600" : "text-red-600"
                  }
                >
                  {(healthFactor.value - 1.2).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Distance to Critical (1.0):</span>
                <span
                  className={
                    healthFactor.value >= 1.0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {(healthFactor.value - 1.0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Info */}
        {!position.hasActiveBorrow && (
          <div className="mt-6 p-4 bg-blue-100 border border-blue-300 rounded">
            <p className="text-blue-800 font-semibold">ℹ️ Empty State Display</p>
            <p className="text-sm text-blue-600 mt-1">
              User has no active borrowing position. Component should show empty
              state with:
            </p>
            <ul className="text-sm text-blue-600 mt-2 ml-4 list-disc">
              <li>Message: "No health factor available"</li>
              <li>Call-to-action: "Borrow assets to see your health factor"</li>
            </ul>
          </div>
        )}
      </div>

      {/* Expected Results Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Expected Test Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">User Profile</th>
                <th className="p-2 text-left">Health Factor</th>
                <th className="p-2 text-left">Risk Level</th>
                <th className="p-2 text-left">Gauge Position</th>
                <th className="p-2 text-left">Alert Message</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">0xf350...4e01</td>
                <td className="p-2">15.12</td>
                <td className="p-2 text-green-600 font-bold">Safe</td>
                <td className="p-2">Far right (capped at 3.0)</td>
                <td className="p-2 text-green-600">Account is healthy</td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="p-2 font-mono text-xs">0x5056...1c3</td>
                <td className="p-2">1.80</td>
                <td className="p-2 text-yellow-600 font-bold">Warning</td>
                <td className="p-2">Slightly right of center</td>
                <td className="p-2 text-yellow-600">Moderate risk level</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">Fresh wallet</td>
                <td className="p-2 text-gray-400">N/A</td>
                <td className="p-2 text-gray-400">N/A</td>
                <td className="p-2 text-gray-400">Empty state</td>
                <td className="p-2 text-gray-400">No health factor</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
