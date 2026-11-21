"use client";

import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChartTooltip } from "@/hooks/useChartTooltip";
import {
  calculateDailyMovements,
  findLargestDailyMovements,
  hasSufficientHistoryForDailyMovements,
  type DailyMovement,
} from "@/lib/dailyMovements";
import type { PortfolioValuePoint } from "@/lib/benchmark";

interface LargestDailyMovementsProps {
  /** Portfolio history points, sorted by timestamp ascending */
  portfolioHistory: PortfolioValuePoint[];
  /** Chart data points for linking to chart (from PortfolioPerformanceBenchmarkChart) */
  chartPortfolioPts: { timestamp: number; value: number; x: number; y: number }[];
  /** Chart width for positioning */
  chartWidth: number;
  /** Chart height for positioning */
  chartHeight: number;
  /** Callback when a movement is selected (to highlight on chart) */
  onSelectMovement?: (movement: DailyMovement, pointIndex: number) => void;
  /** Currently selected movement day (for highlighting) */
  selectedDay?: number | null;
  className?: string;
}

/**
 * Format a day timestamp to a readable date string.
 */
function formatMovementDate(day: number): string {
  return new Date(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * Format a currency value.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage change.
 */
function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(2)}%`;
}

/**
 * Find the chart point index that corresponds to a movement day.
 * Returns the index of the point closest to the end of that day.
 */
function findChartPointForDay(
  chartPts: { timestamp: number }[],
  day: number
): number | null {
  if (chartPts.length === 0) return null;

  const dayEnd = day + 24 * 60 * 60 * 1000 - 1; // End of day (23:59:59.999)
  let bestIndex = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < chartPts.length; i++) {
    const diff = Math.abs(chartPts[i].timestamp - dayEnd);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  // Only return if we found a point within the same day (within 12 hours)
  if (bestDiff <= 12 * 60 * 60 * 1000) {
    return bestIndex;
  }
  return null;
}

export function LargestDailyMovements({
  portfolioHistory,
  chartPortfolioPts,
  chartWidth,
  chartHeight,
  onSelectMovement,
  selectedDay,
  className,
}: LargestDailyMovementsProps) {
  const movements = calculateDailyMovements(portfolioHistory);
  const { largestGain, largestLoss } = findLargestDailyMovements(movements);
  const hasSufficientHistory = hasSufficientHistoryForDailyMovements(portfolioHistory);

  // Chart tooltip for keyboard navigation
  const tooltip = useChartTooltip({
    ariaLabel: "Largest daily portfolio movements",
    describePoint: (i) => {
      if (i === 0 && largestGain) {
        return `Largest gain: ${formatMovementDate(largestGain.day)}, ${formatCurrency(largestGain.value)}, ${formatPercentChange(largestGain.changePercent)} change`;
      }
      if (i === 1 && largestLoss) {
        return `Largest loss: ${formatMovementDate(largestLoss.day)}, ${formatCurrency(largestLoss.value)}, ${formatPercentChange(largestLoss.changePercent)} change`;
      }
      return "";
    },
    dataLength: (largestGain ? 1 : 0) + (largestLoss ? 1 : 0),
  });

  // Handle keyboard selection
  const handleKeyDown = (e: React.KeyboardEvent, movement: DailyMovement) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const pointIndex = findChartPointForDay(chartPortfolioPts, movement.day);
      if (pointIndex !== null && onSelectMovement) {
        onSelectMovement(movement, pointIndex);
      }
      return;
    }
    // Arrow keys move between the gain/loss cards and announce the active one.
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? 1 : 0;
      const target = next === 0 ? largestGain : largestLoss;
      if (!target) return;
      tooltip.showAt(next);
      const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]'
      );
      buttons?.[next]?.focus();
    }
  };

  // Handle click selection
  const handleClick = (movement: DailyMovement) => {
    const pointIndex = findChartPointForDay(chartPortfolioPts, movement.day);
    if (pointIndex !== null && onSelectMovement) {
      onSelectMovement(movement, pointIndex);
    }
  };

  // Loading state
  if (portfolioHistory.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <EmptyState
            title="Loading movements…"
            description="Calculating daily portfolio changes."
            className="h-32 rounded-xl bg-transparent py-4"
          />
        </CardContent>
      </Card>
    );
  }

  // Empty state - insufficient history
  if (!hasSufficientHistory) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <EmptyState
            title="Insufficient history"
            description="We need at least two days of portfolio data to calculate daily movements. Check back after more history accumulates."
            action={
              <Button asChild size="sm" variant="outline">
                <a href="/performance">View performance details</a>
              </Button>
            }
            className="h-32 rounded-xl bg-transparent py-4"
          />
        </CardContent>
      </Card>
    );
  }

  // Error/empty state - no movements found (should not happen if hasSufficientHistory is true)
  if (!largestGain && !largestLoss) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <EmptyState
            title="No daily movements"
            description="Portfolio value hasn't changed between recorded days."
            className="h-32 rounded-xl bg-transparent py-4"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4 space-y-3">
        {/* Accessible live region for screen readers */}
        <span
          id={tooltip.tooltipId}
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {tooltip.isVisible ? tooltip.activeDescription : ""}
        </span>
        <span id={tooltip.instructionsId} className="sr-only">
          Use arrow keys to navigate between largest gain and loss. Press Enter to highlight on chart.
        </span>

        <h3 className="text-sm font-semibold text-foreground">
          Largest Daily Movements
        </h3>

        <div className="grid grid-cols-2 gap-3" role="listbox" aria-label="Largest daily movements">
          {/* Largest Gain */}
          {largestGain && (
            <button
              type="button"
              role="option"
              aria-selected={selectedDay === largestGain.day}
              aria-describedby={tooltip.instructionsId}
              aria-label={`Largest gain: ${formatMovementDate(largestGain.day)}, portfolio value ${formatCurrency(largestGain.value)}, up ${formatPercentChange(largestGain.changePercent)}. Press Enter to highlight on chart.`}
              onClick={() => handleClick(largestGain)}
              onKeyDown={(e) => handleKeyDown(e, largestGain)}
              onFocus={() => tooltip.showAt(0)}
              onBlur={tooltip.hide}
              tabIndex={0}
              className={cn(
                "relative rounded-lg p-3 text-left transition-all",
                "bg-green-500/10 border border-green-500/20",
                "hover:bg-green-500/15 hover:border-green-500/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                selectedDay === largestGain.day && "ring-2 ring-green-500 bg-green-500/15"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-green-500 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-green-400">Largest Gain</span>
              </div>
              <div className="text-lg font-bold text-green-400 tabular-nums">
                {formatCurrency(largestGain.change)}
              </div>
              <div className="text-xs text-green-300">
                {formatPercentChange(largestGain.changePercent)}
              </div>
              <div className="mt-1 text-[10px] text-foreground-muted">
                {formatMovementDate(largestGain.day)}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-green-400">
                <span>Highlight on chart</span>
                <ChevronRight size={10} aria-hidden="true" />
              </div>
            </button>
          )}

          {/* Largest Loss */}
          {largestLoss && (
            <button
              type="button"
              role="option"
              aria-selected={selectedDay === largestLoss.day}
              aria-describedby={tooltip.instructionsId}
              aria-label={`Largest loss: ${formatMovementDate(largestLoss.day)}, portfolio value ${formatCurrency(largestLoss.value)}, down ${formatPercentChange(largestLoss.changePercent)}. Press Enter to highlight on chart.`}
              onClick={() => handleClick(largestLoss)}
              onKeyDown={(e) => handleKeyDown(e, largestLoss)}
              onFocus={() => tooltip.showAt(1)}
              onBlur={tooltip.hide}
              tabIndex={0}
              className={cn(
                "relative rounded-lg p-3 text-left transition-all",
                "bg-red-500/10 border border-red-500/20",
                "hover:bg-red-500/15 hover:border-red-500/40",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                selectedDay === largestLoss.day && "ring-2 ring-red-500 bg-red-500/15"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={14} className="text-red-500 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-red-400">Largest Loss</span>
              </div>
              <div className="text-lg font-bold text-red-400 tabular-nums">
                {formatCurrency(largestLoss.change)}
              </div>
              <div className="text-xs text-red-300">
                {formatPercentChange(largestLoss.changePercent)}
              </div>
              <div className="mt-1 text-[10px] text-foreground-muted">
                {formatMovementDate(largestLoss.day)}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-red-400">
                <span>Highlight on chart</span>
                <ChevronRight size={10} aria-hidden="true" />
              </div>
            </button>
          )}

          {/* Placeholder when only one movement exists */}
          {!largestGain && largestLoss ? (
            <div className="col-span-2" aria-hidden="true" />
          ) : largestGain && !largestLoss ? (
            <div className="col-span-2" aria-hidden="true" />
          ) : null}
        </div>

        {/* Keyboard navigation hints */}
        <p className="text-[10px] text-foreground-muted text-center">
          Use ← → to move between movements, Enter to highlight on chart
        </p>
      </CardContent>
    </Card>
  );
}