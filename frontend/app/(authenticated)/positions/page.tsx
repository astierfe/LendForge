'use client';

import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAccount } from 'wagmi';
import { useUserPositions } from '@/hooks/useUserPositions';
import { PositionFilters } from './components/PositionFilters';
import { PositionsTable } from './components/PositionsTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Wallet } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Positions Page
 *
 * Displays all user positions (active, repaid, liquidated) with filtering and pagination
 *
 * Features:
 * - Filter positions by status (ALL, ACTIVE, REPAID, LIQUIDATED)
 * - Paginated table view
 * - Historical position tracking via subgraph
 * - Real-time data for active positions
 *
 * Data Architecture:
 * - Historical positions: Subgraph (GET_USER_POSITIONS_ALL)
 * - Active position real-time data: On-chain (could be enhanced later)
 */
export default function PositionsPage() {
  const { address, isConnected } = useAccount();
  const {
    positions,
    paginatedPositions,
    filteredPositions,
    isLoading,
    error,
    statusFilter,
    setStatusFilter,
    currentPage,
    totalPages,
    setCurrentPage,
  } = useUserPositions(address);

  // Calculate counts for filter badges
  const counts = useMemo(() => {
    return {
      all: positions.length,
      active: positions.filter((p) => p.status === 'ACTIVE').length,
      repaid: positions.filter((p) => p.status === 'REPAID').length,
      liquidated: positions.filter((p) => p.status === 'LIQUIDATED').length,
    };
  }, [positions]);

  return (
    <>
      <Header title="My Positions" />
      <PageContainer>
        <div className="space-y-6">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Your Positions</h1>
            <p className="text-muted-foreground">
              View your complete position history across all statuses
            </p>
          </div>

          {/* Wallet Not Connected */}
          {!isConnected && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertTitle>Wallet Not Connected</AlertTitle>
              <AlertDescription>
                Please connect your wallet to view your positions.
              </AlertDescription>
            </Alert>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Positions</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Connected - Show Filters and Table */}
          {isConnected && (
            <>
              {/* Filter Buttons */}
              <PositionFilters
                statusFilter={statusFilter}
                onFilterChange={setStatusFilter}
                counts={counts}
              />

              {/* Positions Table */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {statusFilter === 'ALL'
                      ? 'All Positions'
                      : `${statusFilter.charAt(0).toUpperCase()}${statusFilter.slice(1).toLowerCase()} Positions`}
                  </CardTitle>
                  <CardDescription>
                    {filteredPositions.length === 0
                      ? 'No positions found'
                      : `Showing ${filteredPositions.length} position${filteredPositions.length !== 1 ? 's' : ''}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PositionsTable
                    positions={paginatedPositions}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>

              {/* Info Box */}
              {positions.length > 0 && (
                <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
                  <p>
                    <strong>Note:</strong> Historical positions are fetched from TheGraph subgraph.
                    Active positions show real-time health factor and borrowed amounts from the blockchain.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </>
  );
}
