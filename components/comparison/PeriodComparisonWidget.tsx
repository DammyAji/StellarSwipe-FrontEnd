"use client";

import React, { useMemo } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ComparisonGranularitySelector } from "./ComparisonGranularitySelector";
import { ComparisonMetricCard } from "./ComparisonMetricCard";
import {
  type ComparisonGranularity,
  type PeriodComparisonData,
  formatDateRange,
  createPeriodComparison,
} from "@/lib/comparison";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PeriodComparisonWidgetProps {
  /** Current period metrics */
  pnl: number;
  winRate: number;
  totalTrades: number;

  /** Prior period metrics (null if unavailable) */
  priorPnl: number | null;
  priorWinRate: number | null;
  priorTotalTrades: number | null;

  /** Additional optional metrics */
  additionalMetrics?: Array<{
    label: string;
    current: number;
    prior: number | null;
    suffix?: string;
  }>;

  /** Controlled granularity (optional - defaults to internal state) */
  granularity?: ComparisonGranularity;
  /** Callback when granularity changes (required if granularity is controlled) */
  onGranularityChange?: (granularity: ComparisonGranularity) => void;
  
  /** Demo mode indicator - shows badge when true */
  isDemo?: boolean;

  /** Data request in flight — renders a loading state instead of metrics */
  isLoading?: boolean;
  /** Data request failed — renders an error state instead of metrics */
  error?: unknown;
  /** Retry handler for the error state */
  onRetry?: () => void;
  
  className?: string;
}

/**
 * PeriodComparisonWidget — Displays period-over-period comparison metrics.
 *
 * Features:
 * - Granularity selector (week, month, quarter, year)
 * - Multiple comparison metrics (P&L, win rate, trades, etc.)
 * - Partial period detection and labeling
 * - Accessible design (color + icons + text)
 * - Mobile responsive layout
 *
 * Coexists with existing benchmark overlay widget; no breaking changes.
 */
export function PeriodComparisonWidget({
  pnl,
  winRate,
  totalTrades,
  priorPnl,
  priorWinRate,
  priorTotalTrades,
  additionalMetrics = [],
  granularity: controlledGranularity,
  onGranularityChange,
  isDemo = false,
  isLoading = false,
  error,
  onRetry,
  className,
}: PeriodComparisonWidgetProps) {
  const [internalGranularity, setInternalGranularity] = React.useState<ComparisonGranularity>("month");
  const now = new Date();
  
  // Use controlled granularity if provided, otherwise use internal state
  const granularity = controlledGranularity ?? internalGranularity;
  const setGranularity = onGranularityChange ?? setInternalGranularity;

  // Generate comparison data for each metric
  const pnlComparison = useMemo(
    () => createPeriodComparison(pnl, priorPnl, granularity, now, false),
    [pnl, priorPnl, granularity, now]
  );

  const winRateComparison = useMemo(
    () => createPeriodComparison(winRate, priorWinRate, granularity, now, false),
    [winRate, priorWinRate, granularity, now]
  );

  const tradesComparison = useMemo(
    () => createPeriodComparison(totalTrades, priorTotalTrades, granularity, now, false),
    [totalTrades, priorTotalTrades, granularity, now]
  );

  // Handle additional metrics
  const additionalComparisons = useMemo(
    () =>
      additionalMetrics.map((metric) =>
        createPeriodComparison(metric.current, metric.prior, granularity, now, false)
      ),
    [additionalMetrics, granularity, now]
  );

  // Check if any metric has incomplete data
  const hasIncompleteData =
    !pnlComparison.currentPeriod.isComplete ||
    !winRateComparison.currentPeriod.isComplete ||
    !tradesComparison.currentPeriod.isComplete;

  // Check if any metric has missing prior data
  const hasMissingPriorData =
    pnlComparison.metadata.hasNoPriorData ||
    winRateComparison.metadata.hasNoPriorData ||
    tradesComparison.metadata.hasNoPriorData;

  const currentPeriodRange = pnlComparison.currentPeriod.range;

  // Loading and error are distinct from "no data" (#1055)
  if (isLoading || error) {
    return (
      <Card className={className}>
        <CardHeader>
          <h3 className="font-semibold text-foreground">Period Comparison</h3>
        </CardHeader>
        <CardContent>
          <AnalyticsPanelStateView
            state={error ? "error" : "loading"}
            onRetry={onRetry}
            loadingLabel="Loading period comparison…"
            title="Period comparison"
            requiredData=""
            actionLabel=""
            actionHref=""
          >
            {null}
          </AnalyticsPanelStateView>
        </CardContent>
      </Card>
    );
  }

  // No real activity in the current period: guide instead of showing metrics
  if (totalTrades === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h3 className="font-semibold text-foreground">Period Comparison</h3>
        </CardHeader>
        <CardContent>
          <AnalyticsEmptyState
            title="No trades in this period"
            requiredData="Period comparison needs at least one executed trade in the selected period."
            actionLabel="Browse signals"
            actionHref="/app"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Period Comparison</h3>
            {isDemo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="text-xs text-foreground-muted hidden sm:inline">
                Simulated prior data
              </span>
            )}
            <ComparisonGranularitySelector
              value={granularity}
              onChange={setGranularity}
            />
          </div>
        </div>
        <p className="text-xs text-foreground-muted mt-1">
          {formatDateRange(currentPeriodRange.start, currentPeriodRange.end)}
        </p>

        {/* Incomplete Period Warning */}
        {hasIncompleteData && (
          <div className="mt-3 flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2 border border-amber-500/20">
            <AlertCircle
              size={16}
              className="flex-shrink-0 text-amber-400 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs text-amber-200">
              This period is incomplete (
              {pnlComparison.currentPeriod.completenessPercent}% complete). Metrics may
              change as the period progresses.
            </div>
          </div>
        )}

        {/* Missing Prior Data Notice */}
        {hasMissingPriorData && (
          <div className="mt-3 flex gap-2 rounded-lg bg-sky-500/10 px-3 py-2 border border-sky-500/20">
            <Info
              size={16}
              className="flex-shrink-0 text-sky-400 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs text-sky-200">
              No prior period data available for this comparison.
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Core Metrics */}
          <ComparisonMetricCard
            label="P&L"
            metrics={pnlComparison.metrics}
            formatValue={(v) => `$${formatNumber(v, 2)}`}
            suffix="USD"
          />

          <ComparisonMetricCard
            label="Win Rate"
            metrics={winRateComparison.metrics}
            formatValue={(v) => `${formatNumber(v, 1)}%`}
            showAbsoluteOnly
          />

          <ComparisonMetricCard
            label="Total Trades"
            metrics={tradesComparison.metrics}
            formatValue={(v) => Math.round(v).toString()}
          />

          {/* Additional Metrics */}
          {additionalMetrics.map((metric, index) => (
            <ComparisonMetricCard
              key={`${metric.label}-${index}`}
              label={metric.label}
              metrics={additionalComparisons[index].metrics}
              suffix={metric.suffix}
            />
          ))}
        </div>

        {/* Period Range Reference */}
        <div className="mt-4 grid gap-2 text-xs text-foreground-subtle pt-4 border-t border-border/30">
          <div>
            <span className="font-medium">Current:</span>{" "}
            {formatDateRange(
              currentPeriodRange.start,
              currentPeriodRange.end
            )}
          </div>
          <div>
            <span className="font-medium">Prior:</span>{" "}
            {formatDateRange(
              pnlComparison.priorPeriod.range.start,
              pnlComparison.priorPeriod.range.end
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
