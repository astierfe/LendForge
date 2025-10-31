'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle>Welcome to LendForge</CardTitle>
            <CardDescription>
              Your multi-collateral lending dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Dashboard content coming soon...
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
