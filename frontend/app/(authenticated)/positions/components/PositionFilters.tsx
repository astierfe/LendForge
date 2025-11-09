"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Activity, Layers } from "lucide-react";
import { PositionStatus } from "@/hooks/useUserPositions";

interface PositionFiltersProps {
  statusFilter: PositionStatus | "ALL";
  onFilterChange: (status: PositionStatus | "ALL") => void;
  counts: {
    all: number;
    active: number;
    repaid: number;
    liquidated: number;
  };
}

/**
 * PositionFilters Component
 *
 * Filter buttons to show positions by status (ALL, ACTIVE, REPAID, LIQUIDATED)
 *
 * Features:
 * - Visual filter buttons with icons
 * - Count badges showing number of positions per status
 * - Active state highlighting
 * - Responsive layout
 */
export function PositionFilters({
  statusFilter,
  onFilterChange,
  counts,
}: PositionFiltersProps) {
  const filters = [
    {
      id: "ALL" as const,
      label: "All Positions",
      icon: Layers,
      count: counts.all,
      color: "text-blue-600",
      activeColor: "bg-blue-600",
    },
    {
      id: "ACTIVE" as const,
      label: "Active",
      icon: Activity,
      count: counts.active,
      color: "text-green-600",
      activeColor: "bg-green-600",
    },
    {
      id: "REPAID" as const,
      label: "Repaid",
      icon: CheckCircle2,
      count: counts.repaid,
      color: "text-gray-600",
      activeColor: "bg-gray-600",
    },
    {
      id: "LIQUIDATED" as const,
      label: "Liquidated",
      icon: XCircle,
      count: counts.liquidated,
      color: "text-red-600",
      activeColor: "bg-red-600",
    },
  ];

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = statusFilter === filter.id;

          return (
            <Button
              key={filter.id}
              variant={isActive ? "default" : "outline"}
              onClick={() => onFilterChange(filter.id)}
              className={`
                flex items-center gap-2
                ${isActive ? filter.activeColor : ""}
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{filter.label}</span>
              <span
                className={`
                  ml-1 rounded-full px-2 py-0.5 text-xs font-semibold
                  ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  }
                `}
              >
                {filter.count}
              </span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}
