'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  ProtocolMetricsCard,
  TVLChart,
  AssetDistributionChart,
  UtilizationGauge,
  OraclePricesCard,
  RecentActivityCard,
  LiquidationsHistoryCard,
} from '@/components/analytics';

/**
 * Analytics Page - Phase 5B (Minimal Version)
 *
 * Currently displaying:
 * - Protocol Overview (TVL, Borrowed, Utilization, Active Positions)
 * - Asset Distribution Pie Chart
 * - Borrow Utilization Gauge
 *
 * TODO: Add progressively after testing:
 * - TVL Historical Chart (7d/30d)
 * - Oracle Prices with CoinGecko comparison
 * - Recent Activity (Transactions)
 * - Liquidations History
 *
 * All components implement workarounds for known subgraph bugs (ANO_001-004).
 */
export default function AnalyticsPage() {
  return (
    <>
      <Header title="Analytics" />
      <PageContainer>
        <div className="space-y-6">
          {/* Section 1: Protocol Overview */}
          <ProtocolMetricsCard />

          {/* Section 2: Charts - Asset Distribution & Utilization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetDistributionChart />
            <UtilizationGauge />
          </div>

          {/* TODO: Uncomment progressively after testing each component */}

          {/* Section 3: TVL Historical Chart */}
          <div className="grid grid-cols-1 gap-6">
            <TVLChart />
          </div>

          {/* Section 4: Oracle Prices */}
          { <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OraclePricesCard fetchCoinGecko={false} />
          </div>}

          {/* Section 5: Recent Activity */}
          <RecentActivityCard />

          {/* Section 6: Liquidations History */}
          {<LiquidationsHistoryCard />}
        </div>
      </PageContainer>
    </>
  );
}
