"use client";

import { useAdminAccess } from "@/hooks/useAdminAccess";
import { OracleControlPanel } from "./components/OracleControlPanel";
import { EmergencyModeToggle } from "./components/EmergencyModeToggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldAlert, AlertCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";

/**
 * Admin Dashboard Page
 *
 * Restricted to DEPLOYER address only
 * Provides controls for:
 * - Oracle price management (USDC/DAI)
 * - Emergency mode toggle
 * - Future: EVO_001 scenario selection
 *
 * Access Control:
 * - Client-side check via useAdminAccess hook
 * - Compares connected wallet with NEXT_PUBLIC_DEPLOYER_ADDRESS
 * - Shows access denied message for non-admin users
 */
export default function AdminPage() {
  const { isConnected } = useAccount();
  const { isAdmin, isLoading, deployerAddress } = useAdminAccess();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="container mx-auto max-w-4xl py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Oracle price management and emergency controls
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wallet Not Connected</AlertTitle>
          <AlertDescription>
            Please connect your wallet to access the admin dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Oracle price management and emergency controls
          </p>
        </div>

        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is restricted to the protocol deployer only.
            <br />
            <span className="text-xs mt-2 block opacity-70">
              Authorized address: {deployerAddress}
            </span>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border bg-muted p-6">
          <h3 className="font-semibold mb-2">Admin Capabilities</h3>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Modify USDC and DAI oracle prices for testing scenarios</li>
            <li>Enable/disable emergency mode during critical oracle issues</li>
            <li>View real-time protocol metrics and oracle status</li>
            <li>Future: Select EVO_001 test scenarios</li>
          </ul>
        </div>
      </div>
    );
  }

  // Admin access granted
  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Oracle price management and emergency controls
        </p>
      </div>

      {/* Admin Badge */}
      <Alert className="border-green-500 bg-green-50">
        <ShieldAlert className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">Admin Access Verified</AlertTitle>
        <AlertDescription className="text-green-800">
          You are connected as the protocol deployer. Changes will take effect immediately on-chain.
        </AlertDescription>
      </Alert>

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-1">
        {/* Oracle Control Panel */}
        <OracleControlPanel />

        {/* Emergency Mode Toggle */}
        <EmergencyModeToggle />
      </div>

      {/* Future: EVO_001 Scenario Selection */}
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
        <p className="text-sm">
          📝 <strong>Coming Soon:</strong> EVO_001 Test Scenario Selection
        </p>
        <p className="text-xs mt-1">
          Real oracle integration with Chainlink, CoinGecko, and emergency fallback modes
        </p>
      </div>
    </div>
  );
}
