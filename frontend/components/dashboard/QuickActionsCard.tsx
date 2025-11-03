"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useHealthFactor } from "@/hooks/useHealthFactor";

/**
 * QuickActionsCard - Quick action buttons for common operations
 *
 * Shows:
 * - Deposit: Add collateral (always available)
 * - Borrow: Borrow ETH (disabled if no collateral or HF too low)
 * - Repay: Repay debt (disabled if no active borrow)
 *
 * Buttons are contextually enabled/disabled based on user state:
 * - Deposit: Always available
 * - Borrow: Requires collateral AND health factor >= 1.5
 * - Repay: Requires active borrow position
 *
 * Data source: useUserPosition + useHealthFactor hooks
 */
export function QuickActionsCard() {
  const router = useRouter();
  const { data: user, hasDeposits, hasActiveBorrow } = useUserPosition();
  const healthFactor = useHealthFactor();

  // Determine if actions are available
  const canDeposit = true; // Always can deposit
  const canBorrow = hasDeposits && (!healthFactor || healthFactor.canBorrow); // Has collateral AND (no HF yet OR HF allows borrowing)
  const canRepay = hasActiveBorrow; // Has active debt to repay

  // Action handlers
  const handleDeposit = () => {
    router.push('/deposit');
  };

  const handleBorrow = () => {
    if (!canBorrow) return;
    router.push('/borrow');
  };

  const handleRepay = () => {
    if (!canRepay) return;
    router.push('/positions'); // Repay from positions page
  };

  // Get action messages based on state
  const getBorrowMessage = () => {
    if (!hasDeposits) return "Deposit collateral first";
    if (healthFactor && !healthFactor.canBorrow) return `Health factor too low (${healthFactor.value.toFixed(2)})`;
    return "Borrow ETH against your collateral";
  };

  const getRepayMessage = () => {
    if (!hasActiveBorrow) return "No active borrows";
    return "Repay your debt";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common operations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Deposit Button */}
          <div className="space-y-2">
            <Button
              onClick={handleDeposit}
              className="w-full"
              size="lg"
              variant="default"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Deposit
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Add collateral to your position
            </p>
          </div>

          {/* Borrow Button */}
          <div className="space-y-2">
            <Button
              onClick={handleBorrow}
              className="w-full"
              size="lg"
              variant="default"
              disabled={!canBorrow}
            >
              <Banknote className="w-4 h-4 mr-2" />
              Borrow
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {getBorrowMessage()}
            </p>
          </div>

          {/* Repay Button */}
          <div className="space-y-2">
            <Button
              onClick={handleRepay}
              className="w-full"
              size="lg"
              variant="default"
              disabled={!canRepay}
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Repay
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {getRepayMessage()}
            </p>
          </div>
        </div>

        {/* Status Info */}
        {user && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Collateral</p>
                <p className="font-semibold">
                  {hasDeposits ? (
                    <span className="text-green-600">Deposited</span>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Active Borrow</p>
                <p className="font-semibold">
                  {hasActiveBorrow ? (
                    <span className="text-blue-600">Yes</span>
                  ) : (
                    <span className="text-gray-500">No</span>
                  )}
                </p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-muted-foreground text-xs mb-1">Health Factor</p>
                <p className="font-semibold">
                  {healthFactor ? (
                    <span className={
                      healthFactor.level === "safe" ? "text-green-600" :
                      healthFactor.level === "warning" ? "text-yellow-600" :
                      healthFactor.level === "danger" ? "text-orange-600" :
                      "text-red-600"
                    }>
                      {healthFactor.value.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
