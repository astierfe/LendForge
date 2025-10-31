'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PositionsPage() {
  return (
    <>
      <Header title="My Positions" />
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle>Your Positions</CardTitle>
            <CardDescription>
              View and manage your lending positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Positions list coming soon...
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </>
  );
}
