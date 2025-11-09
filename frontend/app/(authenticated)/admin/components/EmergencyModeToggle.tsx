"use client";

import { useState } from "react";
import { useEmergencyMode } from "@/hooks/useEmergencyMode";
import { useEmergencyModeWrite } from "@/hooks/useEmergencyModeWrite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, Info } from "lucide-react";

/**
 * EmergencyModeToggle Component
 *
 * Admin control to enable/disable OracleAggregator emergency mode
 *
 * Emergency mode behavior:
 * - Disables borrowing operations
 * - Disables liquidations
 * - Prevents exploitation during oracle failures
 * - Requires reason when enabling
 *
 * Features:
 * - Display current emergency mode status
 * - Enable emergency mode with reason
 * - Disable emergency mode
 * - Visual warnings for critical state changes
 */
export function EmergencyModeToggle() {
  const { isEmergencyMode, isLoading: statusLoading } = useEmergencyMode();
  const {
    toggleEmergencyMode,
    isPending,
    error,
    transactionHash,
  } = useEmergencyModeWrite();

  const [reason, setReason] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleEnable = async () => {
    if (!reason.trim()) {
      return;
    }

    setSuccessMessage(null);
    await toggleEmergencyMode(true, reason);

    if (!error) {
      setSuccessMessage("Emergency mode ENABLED");
      setReason("");
    }
  };

  const handleDisable = async () => {
    setSuccessMessage(null);
    await toggleEmergencyMode(false, "");

    if (!error) {
      setSuccessMessage("Emergency mode DISABLED");
      setReason("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Emergency Mode Control
        </CardTitle>
        <CardDescription>
          Enable emergency mode to pause borrowing and liquidations during critical oracle issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-green-500 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {transactionHash && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Transaction:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-600"
              >
                {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <div className="rounded-lg border p-4">
          <Label className="text-sm text-muted-foreground">Current Status</Label>
          <div className="mt-2 flex items-center gap-2">
            {statusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isEmergencyMode ? (
              <>
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-lg font-bold text-red-600">EMERGENCY MODE ACTIVE</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-lg font-bold text-green-600">Normal Operation</span>
              </>
            )}
          </div>
          {isEmergencyMode && (
            <p className="mt-2 text-sm text-muted-foreground">
              ⚠️ Borrowing and liquidations are currently disabled
            </p>
          )}
        </div>

        {/* Emergency Mode Controls */}
        {!isEmergencyMode ? (
          <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Enable Emergency Mode
            </h3>

            <div className="space-y-2">
              <Label htmlFor="emergency-reason">
                Reason <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="emergency-reason"
                placeholder="Describe the emergency (e.g., 'Oracle price feed failure detected', 'Suspicious price manipulation', etc.)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                rows={3}
                className="bg-white"
              />
              <p className="text-xs text-red-700">
                Required: Explain why emergency mode is being activated
              </p>
            </div>

            <Alert className="border-red-300 bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900">
                <strong>Warning:</strong> Enabling emergency mode will immediately:
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                  <li>Block all new borrowing operations</li>
                  <li>Prevent liquidations from executing</li>
                  <li>Keep existing positions frozen</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive"
              onClick={handleEnable}
              disabled={isPending || !reason.trim()}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Activate Emergency Mode
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Disable Emergency Mode
            </h3>

            <Alert className="border-green-300 bg-green-100">
              <Info className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>Info:</strong> Disabling emergency mode will:
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                  <li>Resume normal borrowing operations</li>
                  <li>Re-enable liquidation processing</li>
                  <li>Allow protocol to function normally</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              variant="default"
              onClick={handleDisable}
              disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Deactivate Emergency Mode
                </>
              )}
            </Button>
          </div>
        )}

        {/* Information Box */}
        <div className="rounded-lg border bg-muted p-4">
          <h4 className="text-sm font-semibold mb-2">When to Use Emergency Mode</h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Oracle price feed failure or stale data</li>
            <li>Suspected price manipulation or flash loan attack</li>
            <li>Critical contract vulnerability discovered</li>
            <li>Network congestion causing incorrect liquidations</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
