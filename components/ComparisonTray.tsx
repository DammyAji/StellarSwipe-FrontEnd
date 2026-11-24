"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X, AlertCircle, GitCompareArrows, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useComparisonStore, MAX_COMPARISON } from "@/store/useComparisonStore";
import { DateRangePicker } from "@/components/DateRangePicker";
import { AccessibleChart } from "@/components/AccessibleChart";
import type { DateRange } from "@/types/date-range";

export interface WalletPerformanceSeries {
  /** Stable wallet identifier (address or connection id). */
  id: string;
  /** Human-readable legend label, e.g. "0x12…ab34". */
  label: string;
  /** Points with a real value; gaps in history are omitted, never zero-filled. */
  points: Array<{ date: string; value: number }>;
  /** Optional fee-adjusted series; only present when fee inputs are available. */
  adjustedPoints?: Array<{ date: string; value: number }>;
  /** Assumptions used to derive adjusted values, shown alongside the series. */
  feeAssumptions?: string;
  /** True when fee data was incomplete for part of the period. */
  feeDataIncomplete?: boolean;
}

export interface ComparisonTrayProps {
  /** Connected wallets available for selection. */
  wallets?: Array<{ id: string; label: string }>;
  /** Currently selected wallet ids. */
  selectedWalletIds?: string[];
  onSelectedWalletIdsChange?: (ids: string[]) => void;
  /** Shared date range for all selected wallets. */
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  /** Performance series keyed by wallet id. */
  performanceByWallet?: Record<string, WalletPerformanceSeries>;
  /** Loading / error state for the performance data. */
  performanceStatus?: "idle" | "loading" | "error" | "success";
  performanceError?: string | null;
  onRetryPerformance?: () => void;
}

export function ComparisonTray({
  wallets = [],
  selectedWalletIds = [],
  onSelectedWalletIdsChange,
  dateRange,
  onDateRangeChange,
  performanceByWallet = {},
  performanceStatus = "idle",
  performanceError = null,
  onRetryPerformance,
}: ComparisonTrayProps = {}) {
  const { signals, limitReached, removeSignal, clearAll, dismissLimitMessage } =
    useComparisonStore();
  const prefersReducedMotion = useReducedMotion();
  const [showPerformance, setShowPerformance] = useState(false);

  const selectedSeries = useMemo(
    () =>
      selectedWalletIds
        .map((id) => performanceByWallet[id])
        .filter((s): s is WalletPerformanceSeries => Boolean(s)),
    [selectedWalletIds, performanceByWallet]
  );

  const hasAnyPoints = selectedSeries.some((s) => s.points.length > 0);
  const hasAdjusted = selectedSeries.some(
    (s) => (s.adjustedPoints?.length ?? 0) > 0
  );
  const incompleteFeeData = selectedSeries.some((s) => s.feeDataIncomplete);

  const toggleWallet = (id: string) => {
    if (!onSelectedWalletIdsChange) return;
    onSelectedWalletIdsChange(
      selectedWalletIds.includes(id)
        ? selectedWalletIds.filter((w) => w !== id)
        : [...selectedWalletIds, id]
    );
  };

  // Empty state: guide users to start comparing instead of hiding the tray
  if (signals.length === 0 && !limitReached) {
    return (
      <div
        role="region"
        aria-label="Signal comparison tray"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-background/95 backdrop-blur border-t border-border shadow-lg",
          "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-3xl flex-col items-center gap-3 text-center",
            "sm:flex-row sm:justify-between sm:text-left"
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              aria-hidden="true"
            >
              <GitCompareArrows className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                No signals selected for comparison
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add up to {MAX_COMPARISON} signals from the feed to compare their
                performance side by side.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/compare">Browse signals to compare</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Signal comparison tray"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur border-t border-border shadow-lg",
        // Safe-area insets: keep content above the home indicator on iOS/notched devices
        "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      )}
    >
      {/* Limit-reached banner */}
      <AnimatePresence>
        {limitReached && (
          <motion.div
            key="limit-banner"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            role="alert"
            aria-live="assertive"
            className={cn(
              "flex items-center justify-between gap-2",
              "mb-3 rounded-md bg-destructive/10 border border-destructive/30",
              "px-3 py-2 text-sm text-destructive"
            )}
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              You can compare up to {MAX_COMPARISON} signals at once. Remove one
              to add another.
            </span>
            <button
              type="button"
              aria-label="Dismiss limit message"
              onClick={dismissLimitMessage}
              className="rounded p-0.5 hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-wallet performance comparison */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={showPerformance}
            aria-controls="wallet-performance-panel"
            onClick={() => setShowPerformance((v) => !v)}
          >
            {showPerformance ? "Hide" : "Compare"} wallet performance
          </Button>
          {dateRange && onDateRangeChange && (
            <DateRangePicker
              value={dateRange}
              onChange={onDateRangeChange}
              aria-label="Performance comparison date range"
            />
          )}
        </div>

        {showPerformance && (
          <div
            id="wallet-performance-panel"
            className="mt-3 rounded-md border border-border bg-background/60 p-3"
          >
            {wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Connect a wallet to compare performance.
              </p>
            ) : (
              <fieldset className="mb-3">
                <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Wallets
                </legend>
                <div className="flex flex-wrap gap-2">
                  {wallets.map((wallet) => {
                    const checked = selectedWalletIds.includes(wallet.id);
                    return (
                      <label
                        key={wallet.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                          "focus-within:ring-1 focus-within:ring-ring",
                          checked
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleWallet(wallet.id)}
                        />
                        <span className="max-w-[140px] truncate">
                          {wallet.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {selectedWalletIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select one or more wallets to compare their performance.
              </p>
            ) : performanceStatus === "loading" ? (
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading wallet performance…
              </p>
            ) : performanceStatus === "error" ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {performanceError ?? "Could not load wallet performance."}
                </span>
                {onRetryPerformance && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetryPerformance}
                  >
                    Retry
                  </Button>
                )}
              </div>
            ) : !hasAnyPoints ? (
              <p className="text-sm text-muted-foreground">
                No performance history is available for the selected wallets in
                this period.
              </p>
            ) : (
              <>
                <AccessibleChart
                  aria-label="Portfolio performance by connected wallet"
                  series={selectedSeries.flatMap((s) => {
                    const base = {
                      id: s.id,
                      label: s.label,
                      points: s.points,
                    };
                    if (!s.adjustedPoints?.length) return [base];
                    return [
                      base,
                      {
                        id: `${s.id}-adjusted`,
                        label: `${s.label} (fee-adjusted)`,
                        points: s.adjustedPoints,
                        dashed: true,
                      },
                    ];
                  })}
                  xKey="date"
                  yKey="value"
                  valueFormatter={(v: number) => `${v.toFixed(2)}%`}
                  connectNulls={false}
                />
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    Solid lines show gross returns; dashed lines show
                    fee-adjusted returns.
                  </p>
                  {hasAdjusted &&
                    selectedSeries
                      .filter((s) => s.feeAssumptions)
                      .map((s) => (
                        <p key={`${s.id}-assumptions`}>
                          {s.label} assumptions: {s.feeAssumptions}
                        </p>
                      ))}
                  {incompleteFeeData && (
                    <p className="text-amber-600 dark:text-amber-500">
                      Fee data is incomplete for part of this period;
                      fee-adjusted values may be missing.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tray items + clear-all row */}
      <div className="flex items-center gap-3 flex-wrap">
        <AnimatePresence initial={false}>
          {signals.map((signal) => (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              className={cn(
                "flex items-center gap-1.5 rounded-full",
                "bg-secondary text-secondary-foreground",
                "pl-3 pr-1.5 py-1 text-sm font-medium"
              )}
            >
              <span className="max-w-[140px] truncate">{signal.ticker}</span>
              <button
                type="button"
                aria-label={`Remove ${signal.ticker} from comparison`}
                onClick={() => removeSignal(signal.id)}
                className={cn(
                  "rounded-full p-0.5",
                  "hover:bg-foreground/10",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {signals.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}
