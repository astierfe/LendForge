"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, Activity, CheckCircle2, XCircle } from "lucide-react";
import { Position } from "@/hooks/useUserPositions";
import { formatters } from "@/hooks/useUserPosition";
import { format } from "date-fns";
import { GLOBAL_LIQUIDATION_THRESHOLD } from "@/lib/contracts/config";

interface PositionsTableProps {
  positions: Position[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  ethPriceUSD: number;
}

/**
 * PositionsTable Component
 *
 * Displays user positions in a table with pagination
 *
 * Features:
 * - Table with collateral, borrowed, health factor, status
 * - Status badges with color coding
 * - Date formatting (created, updated, closed)
 * - Transaction count per position
 * - Pagination controls
 * - Etherscan links
 * - Responsive design
 * - Real-time HF calculation for ACTIVE positions (subgraph HF may be stale)
 *
 * IMPORTANT: For ACTIVE positions, HF is calculated using GLOBAL_LIQUIDATION_THRESHOLD
 * to match the contract's HealthCalculator logic (contracts/libraries/HealthCalculator.sol).
 * This ensures consistency with Dashboard display and contract behavior.
 */
export function PositionsTable({
  positions,
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
  ethPriceUSD,
}: PositionsTableProps) {
  // Helper to format USD values
  const formatUSD = (usdBigInt: string): string => {
    const usd = formatters.usdToNumber(usdBigInt);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usd);
  };

  /**
   * Calculate real-time health factor for ACTIVE positions
   * Uses GLOBAL_LIQUIDATION_THRESHOLD (83%) to match contract logic
   * Formula: HF = (collateralUSD × 0.83) / borrowedUSD
   */
  const calculateHealthFactor = (position: Position): string => {
    // For non-ACTIVE positions, use subgraph HF (historical, accurate at time of event)
    if (position.status !== "ACTIVE") {
      return position.healthFactor;
    }

    // For ACTIVE positions, calculate HF using contract formula
    const borrowedWei = BigInt(position.borrowed);
    if (borrowedWei === BigInt(0)) {
      return "999.99"; // No debt = infinite HF
    }

    // Convert BigInt values to numbers (safe for USD amounts < 2^53)
    const collateralUSD = Number(position.totalCollateralUSD) / 1e8; // Assuming 8 decimals
    const borrowedETH = Number(borrowedWei) / 1e18; // 18 decimals for ETH

    // Use real-time ETH price from oracle (passed as prop from parent)
    const borrowedUSD = borrowedETH * ethPriceUSD;

    // Apply global liquidation threshold (matches contract)
    const adjustedCollateral = collateralUSD * GLOBAL_LIQUIDATION_THRESHOLD;
    const healthFactor = adjustedCollateral / borrowedUSD;

    return healthFactor.toFixed(2);
  };

  // Helper to format health factor with color
  const formatHealthFactor = (hfString: string) => {
    const value = parseFloat(hfString);

    // Handle no debt case (health factor = max value)
    if (value > 1000) {
      return { text: "∞", color: "text-green-600" };
    }

    let color = "text-green-600";
    if (value < 1.0) {
      color = "text-red-600";
    } else if (value < 1.2) {
      color = "text-orange-600";
    } else if (value < 1.5) {
      color = "text-yellow-600";
    }

    return {
      text: value.toFixed(2),
      color,
    };
  };

  // Helper to format status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            <Activity className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "REPAID":
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Repaid
          </Badge>
        );
      case "LIQUIDATED":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
            <XCircle className="mr-1 h-3 w-3" />
            Liquidated
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper to format timestamp
  const formatDate = (timestamp: string): string => {
    const date = new Date(parseInt(timestamp) * 1000);
    return format(date, "MMM d, yyyy HH:mm");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Loading positions...
      </div>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p className="text-lg font-semibold">No positions found</p>
        <p className="text-sm mt-2">
          No positions match the selected filter. Try changing the filter or deposit collateral to create a position.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position ID</TableHead>
              <TableHead className="text-right">Collateral (USD)</TableHead>
              <TableHead className="text-right">Borrowed (ETH)</TableHead>
              <TableHead className="text-right">Health Factor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-center">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => {
              // Calculate real-time HF for ACTIVE positions, use subgraph HF for historical
              const calculatedHF = calculateHealthFactor(position);
              const hf = formatHealthFactor(calculatedHF);
              const positionId = position.id.split("-")[1]?.slice(0, 8) || position.id.slice(0, 8);

              return (
                <TableRow key={position.id}>
                  {/* Position ID */}
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {positionId}
                      <a
                        href={`https://sepolia.etherscan.io/address/${position.id.split("-")[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>

                  {/* Collateral USD */}
                  <TableCell className="text-right font-semibold">
                    {formatUSD(position.totalCollateralUSD)}
                  </TableCell>

                  {/* Borrowed */}
                  <TableCell className="text-right">
                    {formatters.weiToEth(position.borrowed) === 0
                      ? "-"
                      : `${formatters.weiToEth(position.borrowed).toFixed(4)} ETH`}
                  </TableCell>

                  {/* Health Factor */}
                  <TableCell className="text-right">
                    <span className={`font-semibold ${hf.color}`}>
                      {hf.text}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>{getStatusBadge(position.status)}</TableCell>

                  {/* Created */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(position.createdAt)}
                  </TableCell>

                  {/* Updated */}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(position.updatedAt)}
                  </TableCell>

                  {/* Transaction Count */}
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {position.transactions.length}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
