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
        </div>
      </PageContainer>
    </>
  );
}
