"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { RouteBreadcrumb } from "@/components/RouteBreadcrumb";
import { PnLShareCardGenerator } from "@/components/analytics/PnLShareCardGenerator";
import { SavedViewTabs } from "@/components/analytics/SavedViewTabs";
import { PeriodComparisonWidget } from "@/components/comparison/PeriodComparisonWidget";
import { usePeriodComparison } from "@/hooks/usePeriodComparison";
import { type ComparisonGranularity } from "@/lib/comparison";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DateRangePicker, type DateRange } from "@/components/DateRangePicker";
import { parseAnalyticsRange, serializeAnalyticsRange } from "@/lib/analyticsDateRange";
import {
  useSavedAnalyticsViewStore,
  snapshotToDateRange,
  type AnalyticsViewSnapshot,
} from "@/store/useSavedAnalyticsViewStore";

const PortfolioAllocationChart = dynamic(
  () =>
    import("@/components/chart/PortfolioAllocationChart").then((mod) => ({
      default: mod.PortfolioAllocationChart,
    })),
  {
    loading: () => <div className="animate-pulse h-48 bg-white/10 rounded" />,
    ssr: false,
  }
);

const PnLWidget = dynamic(
  () =>
    import("@/components/chart/PnLWidget").then((mod) => ({
      default: mod.PnLWidget,
    })),
  {
    loading: () => <div className="animate-pulse h-48 bg-white/10 rounded" />,
    ssr: false,
  }
);

const PerformanceDashboard = dynamic(
  () =>
    import("@/components/performance/PerformanceDashboard").then(
      (m) => m.PerformanceDashboard
    ),
  {
    loading: () => <div className="animate-pulse h-64 bg-white/10 rounded" />,
    ssr: false,
  }
);

// Freshness threshold (ms) after which data is considered stale (#773)
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

type RefreshStatus = "idle" | "pending" | "success" | "error";

// ---------------------------------------------------------------------------
// Per-wallet allocation breakdown (#866)
// ---------------------------------------------------------------------------

/** A single connected wallet and its contribution to the portfolio. */
export interface ConnectedWalletAllocation {
  /** Stable wallet address used as a unique identity. */
  address: string;
  /** Optional human-friendly label (e.g. ENS name). */
  label?: string;
  /** Allocation value contributed by this wallet. */
  value: number;
  /** Whether the wallet is currently connected/available. */
  available: boolean;
}

/** Allocation view mode: aggregate across wallets, or per-wallet breakdown. */
type AllocationViewMode = "aggregate" | "per-wallet";

/**
 * Filter out unavailable wallets so they never corrupt aggregate totals.
 * Returns only wallets that are connected and available.
 */
export function getAvailableWallets(
  wallets: ConnectedWalletAllocation[]
): ConnectedWalletAllocation[] {
  return wallets.filter((wallet) => wallet.available);
}

/**
 * Sum the allocation values of available wallets only.
 * Unavailable wallets are excluded so totals stay accurate.
 */
export function sumAvailableAllocation(
  wallets: ConnectedWalletAllocation[]
): number {
  return getAvailableWallets(wallets).reduce((sum, wallet) => sum + wallet.value, 0);
}

/** Short, distinguishable display identity for a wallet. */
export function formatWalletIdentity(wallet: ConnectedWalletAllocation): string {
  if (wallet.label) return wallet.label;
  const { address } = wallet;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Data freshness (#772)
// ---------------------------------------------------------------------------

/** How long before a metric's data is considered stale. */
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Freshness states for a metric card:
 * - "loading": data has not arrived yet
 * - "fresh": data arrived recently
 * - "stale": data arrived but is older than STALE_AFTER_MS
 * - "unavailable": no timestamp could be determined
 */
type FreshnessState = "loading" | "fresh" | "stale" | "unavailable";

function formatRelativeTime(from: Date, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatExactTime(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Human-readable freshness timestamp for a metric card.
 *
 * - Exposes the exact time via `title` and `aria-label` for assistive tech.
 * - Distinguishes loading / fresh / stale / unavailable states.
 * - Reserves a fixed-height line so timestamp updates never shift layout.
 */
function MetricFreshness({
  updatedAt,
  isLoading,
  label,
}: {
  updatedAt: Date | null;
  isLoading: boolean;
  label: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const state: FreshnessState = isLoading
    ? "loading"
    : updatedAt === null
      ? "unavailable"
      : now.getTime() - updatedAt.getTime() > STALE_AFTER_MS
        ? "stale"
        : "fresh";

  const relative =
    state === "loading"
      ? "Updating…"
      : state === "unavailable"
        ? "Unavailable"
        : updatedAt
          ? formatRelativeTime(updatedAt, now)
          : "Unavailable";

  const exact = updatedAt ? formatExactTime(updatedAt) : null;

  const accessibleLabel =
    state === "loading"
      ? `${label} data is loading`
      : state === "unavailable"
        ? `${label} data freshness is unavailable`
        : `${label} data last updated ${exact}${state === "stale" ? " (stale)" : ""}`;

  const dotClass =
    state === "loading"
      ? "bg-sky-400 animate-pulse"
      : state === "stale"
        ? "bg-amber-400"
        : state === "unavailable"
          ? "bg-slate-500"
          : "bg-emerald-400";

  const textClass =
    state === "stale"
      ? "text-amber-400"
      : state === "unavailable"
        ? "text-foreground-muted"
        : "text-foreground-muted";

  return (
    <p
      className={`mt-1 flex h-4 items-center gap-1.5 text-xs ${textClass}`}
      title={exact ? `Last updated ${exact}` : undefined}
      aria-label={accessibleLabel}
      role="status"
      aria-live="polite"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="truncate">
        {state === "stale" ? `Stale · ${relative}` : relative}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Inner page — has access to hooks
// ---------------------------------------------------------------------------
function AnalyticsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Period-over-period comparison state (#405)
  const [granularity, setGranularity] = useState<ComparisonGranularity>("month");
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

  // Get period comparison data from portfolio
  const {
    pnl,
    winRate,
    totalTrades,
    priorPnl,
    priorWinRate,
    priorTotalTrades,
    isDemo,
  } = usePeriodComparison();

  // Per-wallet allocation breakdown state (#866)
  const [allocationView, setAllocationView] = useState<AllocationViewMode>("aggregate");
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWalletAllocation[]>([]);

  // Stale-data tracking + refresh state (#773)
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [isStale, setIsStale] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const range = parseAnalyticsRange(searchParams.toString());
    if (range) setCustomRange(range);
  }, [searchParams]);

  // Mark data stale once it ages past the freshness threshold.
  useEffect(() => {
    const check = () => setIsStale(Date.now() - lastUpdated > STALE_THRESHOLD_MS);
    check();
    const interval = setInterval(check, 30 * 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  useEffect(() => {
    return () => {
      if (statusResetRef.current) clearTimeout(statusResetRef.current);
    };
  }, []);

  const updateCustomRange = (range: DateRange) => {
    setCustomRange(range);
    router.replace(`${pathname}${serializeAnalyticsRange(range)}`, { scroll: false });
  };

  // ── Saved view tabs (#791) ──────────────────────────────────────────────
  const { activeViewId } = useSavedAnalyticsViewStore();

  /** Build the snapshot of the current live view state for saving. */
  const currentSnapshot = useMemo<AnalyticsViewSnapshot>(() => ({
    rangeStart: customRange.start.toISOString(),
    rangeEnd: customRange.end.toISOString(),
    granularity,
  }), [customRange, granularity]);

  /** Apply a saved view: hydrate local state from the snapshot. */
  const handleApplyView = useCallback((snapshot: AnalyticsViewSnapshot) => {
    const range = snapshotToDateRange(snapshot);
    setCustomRange(range);
    setGranularity(snapshot.granularity);
    router.replace(`${pathname}${serializeAnalyticsRange(range)}`, { scroll: false });
  }, [pathname, router]);

  // Available wallets only — unavailable wallets must not corrupt totals (#866)
  const availableWallets = useMemo(
    () => getAvailableWallets(connectedWallets),
    [connectedWallets]
  );

  const aggregateTotal = useMemo(
    () => sumAvailableAllocation(connectedWallets),
    [connectedWallets]
  );

  return (
    <div className="space-y-6">
      <RouteBreadcrumb />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <DateRangePicker value={customRange} onChange={updateCustomRange} />
      </div>

      <SavedViewTabs
        currentSnapshot={currentSnapshot}
        onApplyView={handleApplyView}
        activeViewId={activeViewId}
      />

      {/* Portfolio allocation — aggregate vs per-wallet breakdown (#866) */}
      <section aria-labelledby="portfolio-allocation-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="portfolio-allocation-heading" className="text-lg font-medium">
            Portfolio allocation
          </h2>
          <div
            role="group"
            aria-label="Portfolio allocation view"
            className="inline-flex rounded-md border border-white/10 p-0.5 text-sm"
          >
            <button
              type="button"
              aria-pressed={allocationView === "aggregate"}
              onClick={() => setAllocationView("aggregate")}
              className={`rounded px-3 py-1 transition-colors ${
                allocationView === "aggregate"
                  ? "bg-white/15 text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Aggregate
            </button>
            <button
              type="button"
              aria-pressed={allocationView === "per-wallet"}
              onClick={() => setAllocationView("per-wallet")}
              className={`rounded px-3 py-1 transition-colors ${
                allocationView === "per-wallet"
                  ? "bg-white/15 text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Per wallet
            </button>
          </div>
        </div>

        {allocationView === "aggregate" ? (
          <PortfolioAllocationChart />
        ) : availableWallets.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No connected wallets available to break down.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Allocation by connected wallet">
            {availableWallets.map((wallet) => {
              const share =
                aggregateTotal > 0 ? (wallet.value / aggregateTotal) * 100 : 0;
              return (
                <li
                  key={wallet.address}
                  className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2 text-sm"
                >
                  <span className="font-mono truncate" title={wallet.address}>
                    {formatWalletIdentity(wallet)}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-foreground-muted">
                      {wallet.value.toLocaleString()}
                    </span>
                    <span className="w-14 text-right">{share.toFixed(1)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Period-over-period comparison statistics below the chart */}
      <PeriodComparisonWidget
        pnl={pnl}
        winRate={winRate}
        totalTrades={totalTrades}
        priorPnl={priorPnl}
        priorWinRate={priorWinRate}
        priorTotalTrades={priorTotalTrades}
        granularity={granularity}
        onGranularityChange={setGranularity}
        isDemo={isDemo}
      />

      <PnLWidget />

      <PerformanceDashboard />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <RouteErrorBoundary>
      <AnalyticsPageInner />
    </RouteErrorBoundary>
  );
}
