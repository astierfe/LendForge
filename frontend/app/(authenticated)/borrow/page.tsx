'use client';

import { Suspense } from "react";
import { Header } from '@/components/layout/Header';
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { BorrowForm } from "@/components/forms/BorrowForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Shield, Info, AlertTriangle } from "lucide-react";

function BorrowPageLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[400px]" />
    </div>
  );
}

export default function BorrowPage() {
  return (
    <>
      <Header title="Borrow ETH" />
      <PageContainer>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form - Left Column (2/3) */}
        <div className="lg:col-span-2">
          <Suspense fallback={<BorrowPageLoading />}>
            <BorrowForm />
          </Suspense>
        </div>

        {/* Info Sidebar - Right Column (1/3) */}
        <div className="space-y-6">
          {/* How Borrowing Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                How Borrowing Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">1. Collateral-Backed Loans</h4>
                <p className="text-muted-foreground">
                  Borrow ETH using your deposited collateral (ETH, USDC, DAI).
                  The amount you can borrow depends on your collateral's LTV ratio.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">2. Interest Accrual</h4>
                <p className="text-muted-foreground">
                  Interest accrues on your borrowed amount at a fixed rate (currently 5% APR).
                  You can repay anytime to reduce interest costs.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">3. Health Factor</h4>
                <p className="text-muted-foreground">
                  Your position's safety is measured by the Health Factor.
                  Keep it above 1.5 to maintain a comfortable margin.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Health Factor Explained */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Health Factor Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-green-600 bg-green-100 shrink-0">
                  Safe
                </Badge>
                <div>
                  <p className="font-semibold">HF ≥ 2.0</p>
                  <p className="text-muted-foreground text-xs">
                    Your position is very safe. You can borrow more if needed.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-yellow-600 bg-yellow-100 shrink-0">
                  Warning
                </Badge>
                <div>
                  <p className="font-semibold">1.5 ≤ HF &lt; 2.0</p>
                  <p className="text-muted-foreground text-xs">
                    Moderate risk. Consider adding collateral or repaying debt.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-orange-600 bg-orange-100 shrink-0">
                  Danger
                </Badge>
                <div>
                  <p className="font-semibold">1.0 ≤ HF &lt; 1.5</p>
                  <p className="text-muted-foreground text-xs">
                    High risk. Add collateral immediately to avoid liquidation.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-red-600 bg-red-100 shrink-0">
                  Liquidation
                </Badge>
                <div>
                  <p className="font-semibold">HF &lt; 1.0</p>
                  <p className="text-muted-foreground text-xs">
                    Position can be liquidated. 10% penalty applies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Important:</strong> Always maintain a health factor above 1.5 to
              account for market volatility and price fluctuations.
            </AlertDescription>
          </Alert>

          {/* Risk Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Risk Warning:</strong> Borrowing against crypto assets carries
              risks. If your collateral value drops significantly, your position may
              be liquidated with a 10% penalty.
            </AlertDescription>
          </Alert>

          {/* LTV Ratios Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">LTV Ratios</CardTitle>
              <CardDescription>Maximum borrowing power by asset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ETH</span>
                <Badge variant="outline">66%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">USDC</span>
                <Badge variant="outline">90%</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DAI</span>
                <Badge variant="outline">90%</Badge>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                LTV (Loan-to-Value) determines how much you can borrow against your collateral.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </PageContainer>
    </>
  );
}
