'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { FlaskConical } from 'lucide-react';
import { TVLOverviewCard } from '@/components/dashboard/TVLOverviewCard';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { UserPositionCard } from '@/components/dashboard/UserPositionCard';
import { HealthFactorDisplay } from '@/components/dashboard/HealthFactorDisplay';

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phase 3 - Dashboard Cards */}
          <TVLOverviewCard />
          <UserPositionCard />
          <HealthFactorDisplay />
          <QuickActionsCard />

          {/* Debug Links */}
          <div className="border-t pt-4 flex gap-2">
            <Link href="/test-hooks">
              <Button variant="outline" size="sm" className="gap-2">
                <FlaskConical className="w-4 h-4" />
                Test Hooks
              </Button>
            </Link>
            <Link href="/test-quick-actions">
              <Button variant="outline" size="sm" className="gap-2">
                <FlaskConical className="w-4 h-4" />
                Test Quick Actions
              </Button>
            </Link>
            <Link href="/test-user-position-card">
              <Button variant="outline" size="sm" className="gap-2">
                <FlaskConical className="w-4 h-4" />
                Test User Position Card
              </Button>
            </Link>
            <Link href="/test-health-factor">
              <Button variant="outline" size="sm" className="gap-2">
                <FlaskConical className="w-4 h-4" />
                factor Test Health
              </Button>
            </Link>            
          </div>
        </div>
      </PageContainer>
    </>
  );
}
