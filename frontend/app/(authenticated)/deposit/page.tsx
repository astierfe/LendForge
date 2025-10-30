'use client';

import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DepositPage() {
  return (
    <>
      <Header title="Deposit Collateral" />
      <div className="flex-1 p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Deposit Collateral</CardTitle>
            <CardDescription>
              Deposit ETH, USDC, or DAI as collateral
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Deposit form coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
