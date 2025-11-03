"use client";

import { useState } from "react";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import {
  useHealthFactor,
  calculateMaxBorrowable,
  simulateHealthFactor,
} from "@/hooks/useHealthFactor";
import { useAccount } from "wagmi";

/**
 * Test page for useUserPosition and useHealthFactor hooks
 * Tests two profiles:
 * - DEPLOYER_ADDRESS (HF 15.12 - safe)
 * - USER_ADDRESS (HF 1.80 - warning/danger)
 */
export default function TestHooksPage() {
  const { address, isConnected } = useAccount();
  const position = useUserPosition();
  const healthFactor = useHealthFactor();

  const [simulatedBorrow, setSimulatedBorrow] = useState<string>("0.1");

  // Test formatters
  const testFormatters = () => {
    const testWei = "1000000000000000000"; // 1 ETH
    const testUSD = "100000000000000000000"; // 100 USD

    return {
      weiToEth: formatters.weiToEth(testWei),
      usdToNumber: formatters.usdToNumber(testUSD),
      tokenToNumber_18: formatters.tokenToNumber(testWei, 18),
      tokenToNumber_6: formatters.tokenToNumber("1000000", 6), // 1 USDC
      formatHealthFactor: formatters.formatHealthFactor("15.123456"),
    };
  };

  // Calculate simulated HF
  const simulatedHF =
    healthFactor && position.data
      ? simulateHealthFactor(
          healthFactor.value,
          position.data.totalBorrowed,
          parseFloat(simulatedBorrow)
        )
      : null;

  // Calculate max borrowable
  const maxBorrowable =
    position.data && position.hasPosition
      ? calculateMaxBorrowable(
          position.data.totalCollateralUSD,
          position.data.totalBorrowed,
          position.data.collaterals
        )
      : 0;

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-4">🧪 Test Hooks Debug</h1>
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
            <li>0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01 (HF 15.12 - safe)</li>
            <li>0x5056AB0F67695F3af9F828a1cFccF1daa1b671c3 (HF 1.80 - danger)</li>
          </ul>
        </div>
      </div>

      {/* useUserPosition Test */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">
          📊 useUserPosition Hook Test
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Status Flags</h3>
            <ul className="space-y-1 text-sm">
              <li>
                hasPosition:{" "}
                {position.hasPosition ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
              <li>
                hasDeposits:{" "}
                {position.hasDeposits ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
              <li>
                hasActiveBorrow:{" "}
                {position.hasActiveBorrow ? (
                  <span className="text-green-600 font-bold">✅ true</span>
                ) : (
                  <span className="text-red-600 font-bold">❌ false</span>
                )}
              </li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <h3 className="font-semibold mb-2">User Totals</h3>
            {position.data ? (
              <ul className="space-y-1 text-sm">
                <li>
                  <strong>Total Collateral:</strong>{" "}
                  {formatters.usdToNumber(position.data.totalCollateralUSD).toFixed(2)}{" "}
                  USD
                </li>
                <li>
                  <strong>Total Borrowed:</strong>{" "}
                  {formatters.weiToEth(position.data.totalBorrowed).toFixed(4)}{" "}
                  ETH
                </li>
                <li>
                  <strong>Active Positions:</strong>{" "}
                  {position.data.activePositions}
                </li>
                <li>
                  <strong>Liquidation Count:</strong>{" "}
                  {position.data.liquidationCount}
                </li>
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">
                No position data (user not in subgraph)
              </p>
            )}
          </div>
        </div>

        {/* Collaterals breakdown */}
        {position.data && position.data.collaterals.length > 0 && (
          <div className="bg-purple-50 p-4 rounded mb-4">
            <h3 className="font-semibold mb-2">Collateral Breakdown</h3>
            <div className="space-y-2">
              {position.data.collaterals.map((collateral) => (
                <div
                  key={collateral.id}
                  className="bg-white p-3 rounded shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-lg">
                        {collateral.asset.symbol}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        (LTV: {collateral.asset.ltv}% | Threshold:{" "}
                        {collateral.asset.liquidationThreshold}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatters
                          .tokenToNumber(
                            collateral.amount,
                            collateral.asset.decimals,
                            collateral.asset.symbol
                          )
                          .toFixed(4)}{" "}
                        {collateral.asset.symbol}
                      </div>
                      <div className="text-sm text-gray-600">
                        ${formatters.usdToNumber(collateral.valueUSD).toFixed(2)}
                        <span className="text-xs text-red-500 ml-1">
                          (⚠️ Bug: shows total, not per-asset)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Positions */}
        {position.data && position.data.positions.length > 0 && (
          <div className="bg-yellow-50 p-4 rounded">
            <h3 className="font-semibold mb-2">
              Active Positions ({position.data.positions.length})
            </h3>
            {position.data.positions.map((pos) => (
              <div key={pos.id} className="bg-white p-3 rounded shadow-sm mb-2">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <strong>Collateral:</strong> $
                    {formatters.usdToNumber(pos.totalCollateralUSD).toFixed(2)}
                  </div>
                  <div>
                    <strong>Borrowed:</strong>{" "}
                    {formatters.weiToEth(pos.borrowed).toFixed(4)} ETH
                  </div>
                  <div>
                    <strong>HF:</strong>{" "}
                    <span className="font-bold text-lg">{pos.healthFactor}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Status: {pos.status} | Created:{" "}
                  {new Date(parseInt(pos.createdAt) * 1000).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Raw JSON */}
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-sm text-gray-600 hover:text-gray-800">
            📄 Raw JSON Data
          </summary>
          <pre className="mt-2 bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(position, null, 2)}
          </pre>
        </details>
      </div>

      {/* useHealthFactor Test */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">
          ❤️ useHealthFactor Hook Test
        </h2>

        {healthFactor ? (
          <div className="space-y-4">
            {/* Health Factor Display */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Health Factor</h3>
                  <p className="text-4xl font-bold mt-2">
                    {healthFactor.value.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-4 py-2 rounded-full font-bold ${healthFactor.color}`}
                  >
                    {healthFactor.label}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 transition-all duration-300 ${
                    healthFactor.level === "safe"
                      ? "bg-green-600"
                      : healthFactor.level === "warning"
                      ? "bg-yellow-600"
                      : healthFactor.level === "danger"
                      ? "bg-orange-600"
                      : "bg-red-600"
                  }`}
                  style={{ width: `${healthFactor.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Progress: {healthFactor.percentage.toFixed(1)}%
              </p>
            </div>

            {/* Risk Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <h4 className="font-semibold mb-2">Risk Assessment</h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <strong>Level:</strong> {healthFactor.level}
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
                    <strong>Tailwind Classes:</strong>{" "}
                    <code className="text-xs bg-white px-2 py-1 rounded">
                      {healthFactor.color}
                    </code>
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded">
                <h4 className="font-semibold mb-2">Risk Thresholds</h4>
                <ul className="space-y-1 text-xs text-gray-700">
                  <li>🟢 Safe: HF ≥ 2.0</li>
                  <li>🟡 Warning: 1.5 ≤ HF &lt; 2.0</li>
                  <li>🟠 Danger: 1.2 ≤ HF &lt; 1.5</li>
                  <li>🔴 Liquidation: HF &lt; 1.2</li>
                </ul>
              </div>
            </div>

            {/* Max Borrowable */}
            <div className="bg-purple-50 p-4 rounded">
              <h4 className="font-semibold mb-2">
                📈 Max Borrowable (Helper Function Test)
              </h4>
              <p className="text-2xl font-bold">
                ${maxBorrowable.toFixed(2)} USD
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Based on collateral LTV ratios (using $2500/ETH estimate)
              </p>
            </div>
            {/* Simulate Borrow */}
            <div className="bg-yellow-50 p-4 rounded">
              <h4 className="font-semibold mb-2">
                🎯 Simulate Health Factor (Helper Function Test)
              </h4>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Additional Borrow (ETH)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={simulatedBorrow}
                    onChange={(e) => setSimulatedBorrow(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">New HF</p>
                  <p className="text-2xl font-bold">
                    {simulatedHF ? simulatedHF.toFixed(2) : "N/A"}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Change</p>
                  <p
                    className={`text-xl font-bold ${
                      simulatedHF && simulatedHF < healthFactor.value
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {simulatedHF
                      ? (simulatedHF - healthFactor.value).toFixed(2)
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <details>
              <summary className="cursor-pointer font-semibold text-sm text-gray-600 hover:text-gray-800">
                📄 Raw JSON Data
              </summary>
              <pre className="mt-2 bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(healthFactor, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="bg-gray-50 p-8 rounded text-center">
            <p className="text-gray-600">
              ⚠️ No health factor data (user has no active positions)
            </p>
          </div>
        )}
      </div>

      {/* Formatters Test */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">🔧 Formatters Test</h2>
        <div className="bg-gray-50 p-4 rounded">
          <pre className="text-sm">
            {JSON.stringify(testFormatters(), null, 2)}
          </pre>
        </div>
        <div className="mt-4 text-xs text-gray-600">
          <p>
            <strong>Expected:</strong>
          </p>
          <ul className="list-disc ml-6">
            <li>weiToEth: 1</li>
            <li>usdToNumber: 100</li>
            <li>tokenToNumber_18: 1</li>
            <li>tokenToNumber_6: 1</li>
            <li>formatHealthFactor: "15.12"</li>
          </ul>
        </div>
      </div>

      {/* Error Display */}
      {position.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">❌ GraphQL Error</h3>
          <pre className="text-xs text-red-700 overflow-auto">
            {JSON.stringify(position.error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
