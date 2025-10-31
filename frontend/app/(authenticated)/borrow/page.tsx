'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BorrowPage() {
  return (
    <>
      <Header title="Borrow ETH" />
      <PageContainer>
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
      </PageContainer>
    </>
  );
}
