"use client";

import { useState } from "react";
import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { useAccount } from "wagmi";

/**
 * Test page for QuickActionsCard component
 *
 * Tests button states and contextual messaging:
 * - DEPLOYER (0xf350...): Has collateral + active borrow (all buttons available)
 * - USER (0x5056...): Different state
 * - Fresh wallet: No collateral, no borrow (only Deposit available)
 *
 * Button Logic:
 * - Deposit: Always enabled
 * - Borrow: Enabled if hasDeposits AND canBorrow (HF >= 1.5)
 * - Repay: Enabled if hasActiveBorrow
 */
export default function TestQuickActionsPage() {
  const { address, isConnected } = useAccount();
  const position = useUserPosition();
  const healthFactor = useHealthFactor();

  const [simulatedClick, setSimulatedClick] = useState<string | null>(null);

  // Simulate button clicks (since actual navigation would leave test page)
  const handleSimulatedAction = (action: string) => {
    setSimulatedClick(action);
    setTimeout(() => setSimulatedClick(null), 2000);
  };

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-4">QuickActionsCard Test</h1>
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
              0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01 - Has collateral + borrow
              (HF 15.12 - all actions available)
            </li>
            <li>
              0x5056AB0F67695F3af9F828a1cFccF1daa1b671c3 - Different state (HF
              1.80)
            </li>
            <li>Fresh wallet - No collateral (only Deposit available)</li>
          </ul>
        </div>
      </div>

      {/* Component Under Test */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">QuickActionsCard Component</h2>
        <QuickActionsCard />
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
                  <strong>Can Borrow:</strong>{" "}
                  {healthFactor.canBorrow ? (
                    <span className="text-green-600 font-bold">✅ Yes</span>
                  ) : (
                    <span className="text-red-600 font-bold">❌ No</span>
                  )}
                </li>
                <li>
                  <strong>Label:</strong> {healthFactor.label}
                </li>
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No health factor (no active borrow)</p>
            )}
          </div>
        </div>

        {/* Button Availability Logic */}
        <div className="mt-6 bg-yellow-50 p-4 rounded">
          <h3 className="font-semibold mb-2">Button Availability Logic</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-white px-2 py-1 rounded">
                canDeposit
              </span>
              <span>= Always true</span>
              <span className="ml-auto font-bold text-green-600">✅ ENABLED</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-white px-2 py-1 rounded">
                canBorrow
              </span>
              <span>
                = hasDeposits ({position.hasDeposits ? "✅" : "❌"}) AND
                canBorrowHF ({healthFactor?.canBorrow ? "✅" : healthFactor ? "❌" : "N/A"})
              </span>
              <span
                className={`ml-auto font-bold ${
                  position.hasDeposits && (!healthFactor || healthFactor.canBorrow)
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {position.hasDeposits && (!healthFactor || healthFactor.canBorrow)
                  ? "✅ ENABLED"
                  : "❌ DISABLED"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-white px-2 py-1 rounded">
                canRepay
              </span>
              <span>
                = hasActiveBorrow ({position.hasActiveBorrow ? "✅" : "❌"})
              </span>
              <span
                className={`ml-auto font-bold ${
                  position.hasActiveBorrow ? "text-green-600" : "text-red-600"
                }`}
              >
                {position.hasActiveBorrow ? "✅ ENABLED" : "❌ DISABLED"}
              </span>
            </div>
          </div>
        </div>

        {/* User Data */}
        {position.data && (
          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">User Data Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total Collateral</p>
                <p className="font-bold">
                  ${formatters.usdToNumber(position.data.totalCollateralUSD).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Total Borrowed</p>
                <p className="font-bold">
                  {formatters.weiToEth(position.data.totalBorrowed).toFixed(4)} ETH
                </p>
              </div>
              <div>
                <p className="text-gray-600">Active Positions</p>
                <p className="font-bold">{position.data.activePositions}</p>
              </div>
              <div>
                <p className="text-gray-600">Collateral Assets</p>
                <p className="font-bold">{position.data.collaterals.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Simulated Click Feedback */}
        {simulatedClick && (
          <div className="mt-6 p-4 bg-blue-100 border border-blue-300 rounded">
            <p className="text-blue-800 font-semibold">
              🔵 Simulated action: <code>{simulatedClick}</code>
            </p>
            <p className="text-sm text-blue-600 mt-1">
              In production, this would navigate to: {simulatedClick === "Deposit" ? "/deposit" : simulatedClick === "Borrow" ? "/borrow" : "/positions"}
            </p>
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
                <th className="p-2 text-left">hasDeposits</th>
                <th className="p-2 text-left">hasActiveBorrow</th>
                <th className="p-2 text-left">Health Factor</th>
                <th className="p-2 text-left">Deposit</th>
                <th className="p-2 text-left">Borrow</th>
                <th className="p-2 text-left">Repay</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">0xf350...4e01</td>
                <td className="p-2">✅ true</td>
                <td className="p-2">✅ true</td>
                <td className="p-2">15.12 (Safe)</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="p-2 font-mono text-xs">0x5056...1c3</td>
                <td className="p-2">✅ true</td>
                <td className="p-2">✅ true</td>
                <td className="p-2">1.80 (Warning)</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">Fresh wallet</td>
                <td className="p-2">❌ false</td>
                <td className="p-2">❌ false</td>
                <td className="p-2">N/A</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-red-600 font-bold">❌ DISABLED</td>
                <td className="p-2 text-red-600 font-bold">❌ DISABLED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
