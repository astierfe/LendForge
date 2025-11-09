"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { GET_USER_POSITIONS_ALL } from "@/lib/graphql/queries/metrics";
import { useState, useMemo, useEffect } from "react";

/**
 * Position status enum (matches subgraph schema)
 */
export type PositionStatus = "ACTIVE" | "REPAID" | "LIQUIDATED";

/**
 * Transaction type for position history
 */
export interface PositionTransaction {
  id: string;
  type: string;
  amount: string;
  timestamp: string;
}

/**
 * Position data structure
 */
export interface Position {
  id: string;
  totalCollateralUSD: string;
  borrowed: string;
  healthFactor: string;
  status: PositionStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  transactions: PositionTransaction[];
}

/**
 * GraphQL query response interface
 */
interface UserPositionsResponse {
  user: {
    id: string;
    positions: Position[];
  } | null;
}

/**
 * Hook response interface
 */
export interface UseUserPositionsResult {
  positions: Position[];
  filteredPositions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  // Filter state
  statusFilter: PositionStatus | "ALL";
  setStatusFilter: (status: PositionStatus | "ALL") => void;
  // Pagination
  currentPage: number;
  totalPages: number;
  positionsPerPage: number;
  setCurrentPage: (page: number) => void;
  paginatedPositions: Position[];
}

/**
 * Hook to fetch and filter all user positions
 *
 * Features:
 * - Fetch all positions from subgraph (ACTIVE, REPAID, LIQUIDATED)
 * - Client-side filtering by status
 * - Pagination support
 * - Real-time refetch capability
 *
 * Usage:
 * ```tsx
 * const { positions, filteredPositions, statusFilter, setStatusFilter } = useUserPositions(address);
 *
 * // Filter to show only active positions
 * setStatusFilter("ACTIVE");
 * ```
 *
 * @param userAddress - Wallet address (lowercased for subgraph query)
 * @param positionsPerPage - Number of positions per page (default: 10)
 * @returns Position data with filtering and pagination
 */
export function useUserPositions(
  userAddress: string | undefined,
  positionsPerPage: number = 10
): UseUserPositionsResult {
  const [statusFilter, setStatusFilter] = useState<PositionStatus | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Normalize address for consistent querying
  const normalizedAddress = userAddress?.toLowerCase() || "";

  // Query all positions from subgraph
  // Note: useSuspenseQuery doesn't support 'skip', so we ensure userAddress is always provided
  const { data, error, refetch } = useSuspenseQuery<UserPositionsResponse>(GET_USER_POSITIONS_ALL, {
    variables: {
      userId: normalizedAddress,
      first: 1000, // Fetch large batch (pagination happens client-side)
      skip: 0,
    },
    // Force refetch when userAddress changes to avoid cache issues
    fetchPolicy: "network-only", // Changed to network-only to prevent cache conflicts between different users
  });

  // Force refetch when address changes to prevent showing cached data from different user
  useEffect(() => {
    if (normalizedAddress) {
      refetch();
    }
  }, [normalizedAddress, refetch]);

  // Extract positions from query result
  const positions: Position[] = useMemo(() => {
    if (!data?.user?.positions) return [];
    return data.user.positions;
  }, [data]);

  // Apply status filter
  const filteredPositions = useMemo(() => {
    if (statusFilter === "ALL") return positions;
    return positions.filter((pos) => pos.status === statusFilter);
  }, [positions, statusFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPositions.length / positionsPerPage);
  const paginatedPositions = useMemo(() => {
    const startIndex = (currentPage - 1) * positionsPerPage;
    const endIndex = startIndex + positionsPerPage;
    return filteredPositions.slice(startIndex, endIndex);
  }, [filteredPositions, currentPage, positionsPerPage]);

  // Reset to page 1 when filter changes
  const setStatusFilterWithReset = (status: PositionStatus | "ALL") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  return {
    positions,
    filteredPositions,
    isLoading: false, // useSuspenseQuery doesn't have loading state (it suspends)
    error: error ? error.message : null,
    refetch,
    statusFilter,
    setStatusFilter: setStatusFilterWithReset,
    currentPage,
    totalPages,
    positionsPerPage,
    setCurrentPage,
    paginatedPositions,
  };
}
