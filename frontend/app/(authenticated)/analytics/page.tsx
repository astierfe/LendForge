'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <>
      <Header title="Analytics" />
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle>Protocol Analytics</CardTitle>
            <CardDescription>
              View historical data and metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Analytics charts coming soon...
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
