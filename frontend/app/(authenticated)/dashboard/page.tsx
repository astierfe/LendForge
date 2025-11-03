'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { FlaskConical } from 'lucide-react';
import { TVLOverviewCard } from '@/components/dashboard/TVLOverviewCard';

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        <div className="grid gap-6">
          {/* Phase 3 - Dashboard Cards */}
          <TVLOverviewCard />

          {/* Debug Link */}
          <div className="border-t pt-4">
            <Link href="/test-hooks">
              <Button variant="outline" size="sm" className="gap-2">
                <FlaskConical className="w-4 h-4" />
                Test Hooks (Debug)
              </Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
