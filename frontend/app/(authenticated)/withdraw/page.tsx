'use client';

import { Suspense } from "react";
import { Header } from '@/components/layout/Header';
import { PageContainer } from "@/components/layout/PageContainer";
import { WithdrawForm } from "@/components/forms/WithdrawForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownFromLine, Shield, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

function WithdrawPageLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[400px]" />
    </div>
  );
}

export default function WithdrawPage() {
  return (
    <>
      <Header title="Withdraw Collateral" />
      <PageContainer>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form - Left Column (2/3) */}
        <div className="lg:col-span-2">
          <Suspense fallback={<WithdrawPageLoading />}>
            <WithdrawForm />
          </Suspense>
        </div>

        {/* Info Sidebar - Right Column (1/3) */}
        <div className="space-y-6">
          {/* Withdrawal Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowDownFromLine className="h-5 w-5" />
                Withdrawal Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">1. Health Factor Safety</h4>
                <p className="text-muted-foreground">
                  When withdrawing collateral with active borrows, your health factor must
                  remain above 1.0 (minimum) or 1.2 (recommended safe threshold).
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">2. No Active Borrows</h4>
                <p className="text-muted-foreground">
                  If you have no active borrows, you can withdraw all your collateral
                  without any restrictions.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">3. Multi-Asset Support</h4>
                <p className="text-muted-foreground">
                  You can withdraw ETH, USDC, or DAI. Each asset affects your health
                  factor differently based on its liquidation threshold.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Health Factor Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Health Factor Safety
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-green-600 bg-green-100 shrink-0">
                  Safe
                </Badge>
                <div>
                  <p className="font-semibold">HF ≥ 1.2 (Recommended)</p>
                  <p className="text-muted-foreground text-xs">
                    Safe threshold with buffer for price volatility. The MAX button uses this threshold.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-orange-600 bg-orange-100 shrink-0">
                  Risky
                </Badge>
                <div>
                  <p className="font-semibold">1.0 ≤ HF &lt; 1.2</p>
                  <p className="text-muted-foreground text-xs">
                    Allowed but risky. Position is vulnerable to price fluctuations.
                    Liquidation risk increases.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-red-600 bg-red-100 shrink-0">
                  Blocked
                </Badge>
                <div>
                  <p className="font-semibold">HF &lt; 1.0</p>
                  <p className="text-muted-foreground text-xs">
                    Withdrawal blocked. Position would be liquidatable.
                    Cannot proceed with this transaction.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liquidation Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Liquidation Thresholds</CardTitle>
              <CardDescription>Safety margins by asset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ETH</span>
                <Badge variant="outline">85%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">USDC</span>
                <Badge variant="outline">95%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DAI</span>
                <Badge variant="outline">95%</Badge>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Liquidation threshold determines when your position becomes liquidatable.
                Higher threshold = more collateral value protects your position.
              </p>
            </CardContent>
          </Card>

          {/* Liquidation Risk Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Liquidation Risk:</strong> Withdrawing collateral lowers your health
              factor. If HF drops below 1.0, your position can be liquidated with a 10% penalty.
              Always maintain HF above 1.2 for safety.
            </AlertDescription>
          </Alert>

          {/* Important Notes */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>MAX Button:</strong> The MAX button calculates the maximum safe
              withdrawal amount that keeps your health factor at 1.2 or above.
              This provides a safety buffer against price volatility.
            </AlertDescription>
          </Alert>

          {/* Safe Withdrawal Tips */}
          <Alert className="bg-blue-50 border-blue-200">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              <strong>Safe Withdrawal Tips:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Always check health factor preview before withdrawing</li>
                <li>Keep HF above 1.2 to account for market volatility</li>
                <li>Consider repaying debt first to increase withdrawal capacity</li>
                <li>Withdraw stablecoins first if you need to reduce risk exposure</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </div>
      </PageContainer>
    </>
  );
}
