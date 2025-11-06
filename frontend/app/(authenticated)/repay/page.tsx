'use client';

import { Suspense } from "react";
import { Header } from '@/components/layout/Header';
import { PageContainer } from "@/components/layout/PageContainer";
import { RepayForm } from "@/components/forms/RepayForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpFromLine, Shield, Info, CheckCircle2, DollarSign } from "lucide-react";

function RepayPageLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[400px]" />
    </div>
  );
}

export default function RepayPage() {
  return (
    <>
      <Header title="Repay Loan" />
      <PageContainer>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form - Left Column (2/3) */}
        <div className="lg:col-span-2">
          <Suspense fallback={<RepayPageLoading />}>
            <RepayForm />
          </Suspense>
        </div>

        {/* Info Sidebar - Right Column (1/3) */}
        <div className="space-y-6">
          {/* How Repayment Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowUpFromLine className="h-5 w-5" />
                How Repayment Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">1. Repay Anytime</h4>
                <p className="text-muted-foreground">
                  You can repay your borrowed ETH at any time, either partially or in full.
                  No early repayment penalties apply.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">2. Interest Calculation</h4>
                <p className="text-muted-foreground">
                  Interest accrues continuously at 5% APR on your borrowed amount.
                  The displayed interest is an estimate based on 30 days average.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">3. Improves Health Factor</h4>
                <p className="text-muted-foreground">
                  Repaying debt reduces your borrowed amount and improves your health factor,
                  lowering liquidation risk.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Repayment Strategies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                Repayment Strategies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-blue-600 bg-blue-100 shrink-0">
                  Partial
                </Badge>
                <div>
                  <p className="font-semibold">Partial Repayment</p>
                  <p className="text-muted-foreground text-xs">
                    Repay a portion of your debt to improve your health factor while maintaining borrowing capacity.
                    Good for managing risk without fully closing your position.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-green-600 bg-green-100 shrink-0">
                  Full
                </Badge>
                <div>
                  <p className="font-semibold">Full Repayment</p>
                  <p className="text-muted-foreground text-xs">
                    Repay your entire debt to clear your borrowed amount.
                    Use the MAX button to automatically calculate the full repayment amount.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health Factor Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Health Factor Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Repaying debt <strong>increases</strong> your health factor:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Less Debt</span>
                  <span className="font-semibold text-green-600">Higher HF ↑</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Lower Risk</span>
                  <span className="font-semibold text-green-600">Safer Position</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Full Repay</span>
                  <span className="font-semibold text-green-600">HF = ∞</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                A higher health factor means your position is safer from liquidation.
                Full repayment eliminates liquidation risk entirely.
              </p>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Tip:</strong> Use the MAX button to automatically calculate the full
              repayment amount including estimated interest. The contract will only charge
              what is actually owed.
            </AlertDescription>
          </Alert>

          {/* Benefits */}
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-900">
              <strong>Benefits of Repaying:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Improves health factor</li>
                <li>Reduces interest costs</li>
                <li>Lowers liquidation risk</li>
                <li>Frees up collateral for withdrawal</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </div>
      </PageContainer>
    </>
  );
}
