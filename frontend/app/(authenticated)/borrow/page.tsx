'use client';

import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BorrowPage() {
  return (
    <>
      <Header title="Borrow ETH" />
      <div className="flex-1 p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrow ETH</CardTitle>
            <CardDescription>
              Borrow ETH against your collateral
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Borrow form coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
