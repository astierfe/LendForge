"use client";

import { useUserPosition, formatters } from "@/hooks/useUserPosition";
import { useHealthFactor, calculateMaxBorrowable } from "@/hooks/useHealthFactor";
import { UserPositionCard } from "@/components/dashboard/UserPositionCard";
import { useAccount } from "wagmi";

/**
 * Test page for UserPositionCard component
 *
 * Tests display of borrowing position:
 * - DEPLOYER (0xf350...): Has collateral + active borrow (HF 15.12)
 * - USER (0x5056...): Has collateral + active borrow (HF 1.80)
 * - Fresh wallet: No collateral, no borrow (empty state)
 *
 * Component Logic:
 * - Shows total borrowed (ETH)
 * - Calculates available to borrow (max borrowable - current borrowed)
 * - Shows current LTV used (%)
 * - Warning if LTV >= 80%
 * - Empty state if no active borrow
 */
export default function TestUserPositionCardPage() {
  const { address, isConnected } = useAccount();
  const position = useUserPosition();
  const healthFactor = useHealthFactor();

  // Constants
  const ETH_PRICE = 2500;

  // Calculations (same as in component)
  let totalBorrowedETH = 0;
  let totalBorrowedUSD = 0;
  let totalCollateralUSD = 0;
  let maxBorrowableUSD = 0;
  let availableToBorrowUSD = 0;
  let availableToBorrowETH = 0;
  let ltvUsed = 0;

  if (position.data && position.hasActiveBorrow) {
    totalBorrowedETH = formatters.weiToEth(position.data.totalBorrowed);
    totalBorrowedUSD = totalBorrowedETH * ETH_PRICE;
    totalCollateralUSD = formatters.usdToNumber(position.data.totalCollateralUSD);

    maxBorrowableUSD = calculateMaxBorrowable(
      position.data.totalCollateralUSD,
      position.data.totalBorrowed,
      position.data.collaterals
    );

    availableToBorrowUSD = Math.max(0, maxBorrowableUSD - totalBorrowedUSD);
    availableToBorrowETH = availableToBorrowUSD / ETH_PRICE;
    ltvUsed = totalCollateralUSD > 0 ? (totalBorrowedUSD / totalCollateralUSD) * 100 : 0;
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-4">UserPositionCard Test</h1>
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
              (HF 15.12, low LTV usage)
            </li>
            <li>
              0x5056AB0F67695F3af9F828a1cFccF1daa1b671c3 - Has collateral + borrow
              (HF 1.80, higher LTV usage)
            </li>
            <li>Fresh wallet - No collateral (empty state)</li>
          </ul>
        </div>
      </div>

      {/* Component Under Test */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">UserPositionCard Component</h2>
        <UserPositionCard />
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
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No health factor (no active borrow)</p>
            )}
          </div>
        </div>

        {/* Calculation Details */}
        {position.hasActiveBorrow && position.data && (
          <div className="mt-6 bg-yellow-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Calculation Details</h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="grid grid-cols-2 gap-2">
                <span>Total Collateral (USD):</span>
                <span className="font-bold">${totalCollateralUSD.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Total Borrowed (ETH):</span>
                <span className="font-bold">{totalBorrowedETH.toFixed(4)} ETH</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Total Borrowed (USD):</span>
                <span className="font-bold">${totalBorrowedUSD.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Max Borrowable (USD):</span>
                <span className="font-bold">${maxBorrowableUSD.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Available to Borrow (USD):</span>
                <span className="font-bold text-green-600">${availableToBorrowUSD.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Available to Borrow (ETH):</span>
                <span className="font-bold text-green-600">{availableToBorrowETH.toFixed(4)} ETH</span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2">
                <span>Current LTV Used:</span>
                <span className={`font-bold ${ltvUsed >= 80 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {ltvUsed.toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span>Warning Threshold:</span>
                <span className="text-orange-600">80%</span>
              </div>
            </div>
          </div>
        )}

        {/* Collateral Assets Details */}
        {position.data && position.data.collaterals.length > 0 && (
          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h3 className="font-semibold mb-2">Collateral Assets</h3>
            <div className="space-y-2">
              {position.data.collaterals.map((col) => {
                const amount = formatters.tokenToNumber(
                  col.amount,
                  col.asset.decimals,
                  col.asset.symbol
                );
                return (
                  <div key={col.id} className="flex justify-between text-sm bg-white p-2 rounded">
                    <span className="font-medium">{col.asset.symbol}</span>
                    <span>{amount.toFixed(col.asset.symbol === "ETH" ? 4 : 2)}</span>
                    <span className="text-gray-600">LTV: {col.asset.ltv}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State Info */}
        {!position.hasActiveBorrow && (
          <div className="mt-6 p-4 bg-blue-100 border border-blue-300 rounded">
            <p className="text-blue-800 font-semibold">
              ℹ️ Empty State Display
            </p>
            <p className="text-sm text-blue-600 mt-1">
              User has no active borrowing position. Component should show empty state with:
            </p>
            <ul className="text-sm text-blue-600 mt-2 ml-4 list-disc">
              <li>Message: "No active borrowing position"</li>
              <li>Call-to-action: "Deposit collateral to start borrowing"</li>
              {position.hasDeposits && <li>Button: "Start Borrowing" (enabled)</li>}
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
                <th className="p-2 text-left">Borrowed (ETH)</th>
                <th className="p-2 text-left">Available (ETH)</th>
                <th className="p-2 text-left">LTV Used</th>
                <th className="p-2 text-left">Warning</th>
                <th className="p-2 text-left">Borrow Button</th>
                <th className="p-2 text-left">Repay Button</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">0xf350...4e01</td>
                <td className="p-2">&gt; 0 ETH</td>
                <td className="p-2">&gt; 0 ETH</td>
                <td className="p-2">&lt; 80%</td>
                <td className="p-2 text-green-600">❌ No warning</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="p-2 font-mono text-xs">0x5056...1c3</td>
                <td className="p-2">&gt; 0 ETH</td>
                <td className="p-2">Varies</td>
                <td className="p-2">Varies</td>
                <td className="p-2 text-orange-600">⚠️ May show warning</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
                <td className="p-2 text-green-600 font-bold">✅ ENABLED</td>
              </tr>
              <tr className="border-t">
                <td className="p-2 font-mono text-xs">Fresh wallet</td>
                <td className="p-2 text-gray-400">N/A</td>
                <td className="p-2 text-gray-400">N/A</td>
                <td className="p-2 text-gray-400">N/A</td>
                <td className="p-2 text-gray-400">Empty state</td>
                <td className="p-2 text-gray-400">Empty state</td>
                <td className="p-2 text-gray-400">Empty state</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
