'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Section } from '@/components/layout/Section';
import { DepositForm } from '@/components/forms/DepositForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

export default function DepositPage() {
  return (
    <>
      <Header title="Deposit Collateral" />
      <PageContainer>
        <Section>
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Deposit Collateral</h1>
              <p className="text-muted-foreground">
                Deposit ETH, USDC, or DAI as collateral to start borrowing against your assets
              </p>
            </div>

            {/* Info Alert */}
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Your deposited assets will be used as collateral. You can borrow up to the LTV (Loan-to-Value)
                ratio of your collateral. Different assets have different LTV ratios: ETH (66%), USDC & DAI (90%).
              </AlertDescription>
            </Alert>

            {/* Deposit Form */}
            <DepositForm />

            {/* Additional Info */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">How it works</CardTitle>
                <CardDescription>
                  Understanding the deposit process
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">1. Choose your asset</h4>
                  <p className="text-muted-foreground">
                    Select between ETH, USDC, or DAI based on your portfolio strategy
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">2. Enter deposit amount</h4>
                  <p className="text-muted-foreground">
                    Specify how much you want to deposit. You can use the MAX button to deposit your entire balance
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">3. Approve (ERC20 only)</h4>
                  <p className="text-muted-foreground">
                    For USDC and DAI, you'll need to approve the contract first. This is a one-time transaction
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">4. Confirm deposit</h4>
                  <p className="text-muted-foreground">
                    Review the preview and confirm the transaction in your wallet
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">5. Start borrowing</h4>
                  <p className="text-muted-foreground">
                    Once deposited, you can borrow against your collateral up to your available credit limit
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>
      </PageContainer>
    </>
  );
}
