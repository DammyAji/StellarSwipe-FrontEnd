"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Info,
  Keyboard,
  Pin,
  PinOff,
  RefreshCw,
  Trophy,
} from "lucide-react";
import {
  useLeaderboard,
  type LeaderboardTimeRange,
} from "@/hooks/useLeaderboard";
import type { SignalProvider } from "@/lib/types";
import { PageTransition } from "@/components/PageTransition";
import { cn } from "@/lib/utils";
import { LeaderboardErrorBoundary } from "@/components/LeaderboardErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWalletStore } from "@/store/useWalletStore";

const PAGE_SIZE = 10;

// #772: how long a metric's underlying data is considered fresh before it is
// surfaced as stale to the user.
const STALE_AFTER_MS = 5 * 60 * 1000;

type FreshnessState = "loading" | "fresh" | "stale" | "unavailable";

type SortField = "rank" | "overallScore" | "winRate" | "recentPerformance";
type SortDirection = "asc" | "desc";
type ColumnKey =
  | "rank"
  | "provider"
  | "overallScore"
  | "winRate"
  | "recentPerformance";

interface ColumnConfig {
  key: ColumnKey;
  label: string;
  width: number;
  align: "left" | "right";
  sortField?: SortField;
  /** #1040: short label used in the inline definitions list. */
  definitionLabel?: string;
  /** #1040: units, time window and direction for non-obvious metrics. */
  definition?: string;
}

const COLUMNS: ColumnConfig[] = [
  { key: "rank", label: "Rank", width: 72, align: "left", sortField: "rank" },
  { key: "provider", label: "Provider", width: 220, align: "left" },
  {
    key: "overallScore",
    label: "Score",
    width: 100,
    align: "right",
    sortField: "overallScore",
    definitionLabel: "Score",
    definition:
      "Overall provider score from 0 to 100, combining accuracy, consistency and signal volume over the selected time window. Higher is better.",
  },
  {
    key: "winRate",
    label: "Win Rate",
    width: 100,
    align: "right",
    sortField: "winRate",
    definitionLabel: "Win Rate",
    definition:
      "Percentage (0–100%) of closed signals that hit their target within the selected time window. Higher is better.",
  },
  {
    key: "recentPerformance",
    label: "Recent",
    width: 100,
    align: "right",
    sortField: "recentPerformance",
    definitionLabel: "Recent",
    definition:
      "Return in percent over the last 7 days, regardless of the selected time window. Positive means gains, negative means losses; higher is better.",
  },
];

// #595: documented, collision-free row action shortcuts for the leaderboard table
const ROW_SHORTCUTS = [
  { keys: "↑ / ↓", action: "Move focus between rows" },
  { keys: "Enter", action: "Open the focused provider's profile" },
  { keys: "C", action: "Copy the focused provider's address" },
];

const TIME_RANGE_TABS: { value: LeaderboardTimeRange; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all-time", label: "All Time" },
];

// #677: every sortable metric gets an obvious, one-click control in the page
// header (in addition to the column headers).
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "rank", label: "Rank" },
  { value: "overallScore", label: "Score" },
  { value: "winRate", label: "Win Rate" },
  { value: "recentPerformance", label: "Recent" },
];

// Sensible default direction per metric: rankings ascend, performance
// metrics descend (best first).
const DEFAULT_DIRECTION: Record<SortField, SortDirection> = {
  rank: "asc",
  overallScore: "desc",
  winRate: "desc",
  recentPerformance: "desc",
};

// #1041: query params used to hand the current leaderboard view to a provider
// profile so "Back" can restore filters, sort order and scroll position.
const VIEW_PARAM = "from";
const VIEW_PARAM_VALUE = "leaderboard";
const SORT_FIELD_PARAM = "sort";
const SORT_DIRECTION_PARAM = "dir";
const PAGE_PARAM = "page";
const SCROLL_PARAM = "scroll";

const SORT_FIELDS: SortField[] = [
  "rank",
  "overallScore",
  "winRate",
  "recentPerformance",
];

function parseSortField(value: string | null): SortField | null {
  return value && (SORT_FIELDS as string[]).includes(value)
    ? (value as SortField)
    : null;
}

function parseSortDirection(value: string | null): SortDirection | null {
  return value === "asc" || value === "desc" ? value : null;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// #1040: non-obvious metrics that get an inline, keyboard-accessible
// definition (units, time window and direction).
const METRIC_DEFINITIONS = COLUMNS.filter(
  (col): col is ColumnConfig & { definition: string; definitionLabel: string } =>
    Boolean(col.definition && col.definitionLabel)
);

// #1040: inline definitions rendered below the table so they never cover the
// ranking, and reachable by keyboard via the header info buttons.
function MetricDefinitions() {
  return (
    <section
      aria-labelledby="leaderboard-metric-definitions-heading"
      className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <h2
        id="leaderboard-metric-definitions-heading"
        className="mb-2 text-sm font-medium text-white"
      >
        Metric definitions
      </h2>
      <dl className="space-y-2 text-xs text-white/70 sm:text-sm">
        {METRIC_DEFINITIONS.map((col) => (
          <div key={col.key} id={`metric-definition-${col.key}`}>
            <dt className="font-medium text-white/90">{col.definitionLabel}</dt>
            <dd>{col.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// #776: skeleton rows mirror the real table's column widths so the loading
// state reserves the same major regions as the loaded content and avoids
// layout shift. Hidden from assistive tech since it is purely decorative.
function LeaderboardTableSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
    >
      <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="h-4 animate-pulse rounded bg-white/10"
            style={{ width: col.width, maxWidth: "100%" }}
          />
        ))}
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: PAGE_SIZE }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 px-4 py-4"
          >
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className="h-4 animate-pulse rounded bg-white/10"
                style={{ width: col.width, maxWidth: "100%" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// #772: human-readable relative freshness, e.g. "Updated 2m ago".
function formatRelativeTime(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// #772: exact, human-readable timestamp for assistive tech / on interaction.
function formatExactTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// #772: a compact, fixed-height freshness indicator for metric cards. The
// reserved line height keeps card dimensions stable as the label changes.
function FreshnessTimestamp({
  state,
  timestamp,
  now,
}: {
  state: FreshnessState;
  timestamp: number | null;
  now: number;
}) {
  const hasTimestamp = state !== "loading" && state !== "unavailable" && timestamp != null;
  const relative = hasTimestamp ? formatRelativeTime(timestamp, now) : null;
  const exact = hasTimestamp ? formatExactTime(timestamp) : null;

  const label =
    state === "loading"
      ? "Loading freshness…"
      : state === "unavailable"
        ? "Freshness unavailable"
        : state === "stale"
          ? `Stale · updated ${relative}`
          : `Updated ${relative}`;

  const tone =
    state === "stale"
      ? "text-amber-500"
      : state === "unavailable"
        ? "text-muted-foreground"
        : state === "loading"
          ? "text-muted-foreground"
          : "text-emerald-500";

  return (
    <span
      className={cn(
        "flex h-4 items-center gap-1 text-[11px] leading-4 tabular-nums",
        tone
      )}
      title={exact ?? undefined}
      aria-label={exact ? `${label}. Exact time: ${exact}` : label}
      data-freshness={state}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          state === "stale"
            ? "bg-amber-500"
            : state === "unavailable"
              ? "bg-muted-foreground/50"
              : state === "loading"
                ? "bg-muted-foreground/50 animate-pulse"
                : "bg-emerald-500"
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export default function LeaderboardPage() {
  return (
    <LeaderboardErrorBoundary>
      {/* #1041: useSearchParams needs a Suspense boundary in the app router. */}
      <Suspense fallback={<LeaderboardTableSkeleton />}>
        <LeaderboardPageInner />
      </Suspense>
    </LeaderboardErrorBoundary>
  );
}

function LeaderboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data: providers,
    isLoading,
    isFetching,
    error,
    timeRange,
    setTimeRange,
    refetch,
  } = useLeaderboard();
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pinned, setPinned] = useState<ColumnKey[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [page, setPage] = useState(1);
  const publicKey = useWalletStore((s) => s.publicKey);

  // #1041: a view handed back from a provider profile. It is applied once, and
  // only while the restored filters still match the current ones, so changing
  // filters never resurrects stale state.
  const restoredViewRef = useRef<{
    sortField: SortField;
    sortDirection: SortDirection;
    page: number;
    scrollY: number;
  } | null>(null);
  const [restorePending, setRestorePending] = useState(false);

  useEffect(() => {
    if (searchParams.get(VIEW_PARAM) !== VIEW_PARAM_VALUE) return;
    const restoredSortField = parseSortField(searchParams.get(SORT_FIELD_PARAM));
    const restoredSortDirection = parseSortDirection(
      searchParams.get(SORT_DIRECTION_PARAM)
    );
    const restoredPage = parsePositiveInt(searchParams.get(PAGE_PARAM));
    const restoredScroll = parsePositiveInt(searchParams.get(SCROLL_PARAM));
    if (!restoredSortField || !restoredSortDirection || !restoredPage) return;

    restoredViewRef.current = {
      sortField: restoredSortField,
      sortDirection: restoredSortDirection,
      page: restoredPage,
      scrollY: restoredScroll ?? 0,
    };
    setSortField(restoredSortField);
    setSortDirection(restoredSortDirection);
    setPage(restoredPage);
    setRestorePending(true);
    // Only react to the incoming view, not to later filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the restored view once the matching rows are rendered, then drop the
  // params so a later reload or filter change starts from a clean URL.
  useEffect(() => {
    if (!restorePending || isLoading || !providers) return;
    const restored = restoredViewRef.current;
    if (
      !restored ||
      restored.sortField !== sortField ||
      restored.sortDirection !== sortDirection
    ) {
      restoredViewRef.current = null;
      setRestorePending(false);
      return;
    }
    setRestorePending(false);
    window.scrollTo({ top: restored.scrollY, behavior: "auto" });
    router.replace("/leaderboard", { scroll: false });
  }, [restorePending, isLoading, providers, sortField, sortDirection, router]);

  // #773: track when the current view was last refreshed so we can surface a
  // stale-data badge and offer a manual refresh action.
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isStale, setIsStale] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  // Re-evaluate staleness on an interval and whenever the dataset changes.
  useEffect(() => {
    const evaluate = () => {
      setNow(Date.now());
      setIsStale(lastUpdated != null && Date.now() - lastUpdated > STALE_AFTER_MS);
    };
    evaluate();
    const timer = window.setInterval(evaluate, 30 * 1000);
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  // A successful fetch (new data or a completed refetch) resets the clock.
  useEffect(() => {
    if (!isLoading && !error && providers) {
      setLastUpdated(Date.now());
      setIsStale(false);
    }
  }, [providers, isLoading, error]);

  const freshnessState: FreshnessState = isLoading
    ? "loading"
    : error || !providers
      ? "unavailable"
      : lastUpdated != null && now - lastUpdated > STALE_AFTER_MS
        ? "stale"
        : "fresh";

  // #1043: retry keeps the active query (time range, sort, page) intact and
  // reports both the in-flight and failed outcomes to the user.
  const handleRefresh = async () => {
    if (refreshStatus === "pending") return;
    setRefreshStatus("pending");
    try {
      const result = await refetch();
      if (result.error) throw result.error;
      setLastUpdated(Date.now());
      setIsStale(false);
      setRefreshStatus("success");
      toast.success("Leaderboard data refreshed");
    } catch {
      setRefreshStatus("error");
      toast.error("Could not refresh leaderboard data");
    } finally {
      // Return to idle shortly after so the button is reusable.
      window.setTimeout(() => setRefreshStatus("idle"), 2000);
    }
  };

  const isRetrying = refreshStatus === "pending" || isFetching;

  const sortedProviders = useMemo(() => {
    if (!providers) return [];
    const sorted = [...providers];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [providers, sortField, sortDirection]);

  // Return to the first page whenever the ordering or dataset changes.
  useEffect(() => {
    setPage(1);
  }, [sortField, sortDirection, timeRange]);

  const totalResults = sortedProviders.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedProviders = sortedProviders.slice(pageStart, pageStart + PAGE_SIZE);

  const currentUserIndex = publicKey
    ? sortedProviders.findIndex((p) => p.address === publicKey)
    : -1;
  const currentUser =
    currentUserIndex >= 0 ? sortedProviders[currentUserIndex] : null;
  const currentUserPage =
    currentUserIndex >= 0 ? Math.floor(currentUserIndex / PAGE_SIZE) + 1 : null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(DEFAULT_DIRECTION[field]);
    }
  };

  // #1041: hand the current view to the profile so "Back" can restore it.
  const openProviderProfile = (address: string) => {
    const params = new URLSearchParams({
      [VIEW_PARAM]: VIEW_PARAM_VALUE,
      [SORT_FIELD_PARAM]: sortField,
      [SORT_DIRECTION_PARAM]: sortDirection,
      [PAGE_PARAM]: String(currentPage),
      [SCROLL_PARAM]: String(Math.round(window.scrollY)),
    });
    router.push(`/provider/${address}?${params.toString()}`);
  };

  const togglePin = (key: ColumnKey) => {
    setPinned((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : // Keep pinned columns in table order so sticky offsets stay contiguous.
          COLUMNS.map((c) => c.key).filter((k) => current.includes(k) || k === key)
    );
  };

  const resetPins = () => setPinned([]);

  // Left offset for each pinned column, computed from the widths of the
  // pinned columns before it (in table order).
  const pinnedOffsets = useMemo(() => {
    const offsets: Partial<Record<ColumnKey, number>> = {};
    let acc = 0;
    for (const col of COLUMNS) {
      if (pinned.includes(col.key)) {
        offsets[col.key] = acc;
        acc += col.width;
      }
    }
    return offsets;
  }, [pinned]);

  const truncateAddress = (address: string) => {
    return address.length > 20
      ? `${address.slice(0, 10)}...${address.slice(-8)}`
      : address;
  };

  // #1042: sort state announced to assistive tech via aria-sort on the
  // corresponding column header.
  const ariaSortFor = (field?: SortField): "ascending" | "descending" | "none" => {
    if (!field || field !== sortField) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const cellStyle = (key: ColumnKey): CSSProperties | undefined => {
    if (!pinned.includes(key)) return undefined;
    const isLastPinned = pinned[pinned.length - 1] === key;
    return {
      position: "sticky",
      left: pinnedOffsets[key],
      width: COLUMNS.find((c) => c.key === key)?.width,
      zIndex: isLastPinned ? 2 : 1,
    };
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-white/10 sm:w-40" />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {TIME_RANGE_TABS.map((tab) => (
              <div
                key={tab.value}
                className="h-9 w-20 animate-pulse rounded-full bg-white/10"
              />
            ))}
          </div>
          <LeaderboardTableSkeleton />
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6 flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Leaderboard</h1>
            <FreshnessTimestamp
              state={freshnessState}
              timestamp={lastUpdated}
              now={now}
            />
          </div>
          <ErrorState
            title="Failed to load leaderboard"
            description={`${error.message} Your ${TIME_RANGE_TABS.find((t) => t.value === timeRange)?.label ?? timeRange} ranking is still selected — retrying will reload it.`}
            onRetry={handleRefresh}
            retryLabel={isRetrying ? "Retrying…" : "Try again"}
          />
          {refreshStatus === "error" && (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              Retry failed. Check your connection and try again.
            </p>
          )}
        </div>
      </PageTransition>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <PageTransition>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No providers match this ranking"
            description={`No signal providers have recorded results for the ${TIME_RANGE_TABS.find((t) => t.value === timeRange)?.label ?? timeRange} range. Try a wider time range or refresh to check for new data.`}
            action={
              <button
                type="button"
                onClick={() => setTimeRange("all-time")}
                disabled={timeRange === "all-time"}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Show all-time rankings
              </button>
            }
            secondaryAction={
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRetrying && "animate-spin")}
                  aria-hidden="true"
                />
                {isRetrying ? "Refreshing…" : "Refresh"}
              </button>
            }
          />
          {refreshStatus === "error" && (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              Refresh failed. The leaderboard may be temporarily unavailable.
            </p>
          )}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-amber-400" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isRetrying && "animate-spin"
                )}
                aria-hidden="true"
              />
              {isRetrying ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setShortcutsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              Shortcuts
            </button>
          </div>
        </div>

        {refreshStatus === "error" && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            <span>Could not refresh the leaderboard. Showing the last loaded rankings.</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRetrying}
              className="underline underline-offset-2 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        {isStale && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
            This view may be out of date. Refresh to see the latest rankings.
          </div>
        )}

        {shortcutsOpen && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <ul className="space-y-2 text-sm text-white/70">
              {ROW_SHORTCUTS.map((shortcut) => (
                <li key={shortcut.keys} className="flex items-center gap-3">
                  <kbd className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-xs text-white">
                    {shortcut.keys}
                  </kbd>
                  <span>{shortcut.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {TIME_RANGE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTimeRange(tab.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition",
                timeRange === tab.value
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSort(option.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10",
                sortField === option.value && "text-white"
              )}
            >
              {option.label}
              {sortField === option.value &&
                (sortDirection === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                ))}
            </button>
          ))}
          {pinned.length > 0 && (
            <button
              type="button"
              onClick={resetPins}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10"
            >
              <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
              Unpin all
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table
            className="w-full min-w-[640px] border-collapse text-left text-sm"
            aria-label={`Provider leaderboard, ${TIME_RANGE_TABS.find((t) => t.value === timeRange)?.label ?? timeRange} rankings`}
          >
            <caption className="sr-only">
              Provider rankings for the selected time range, sorted by{" "}
              {COLUMNS.find((c) => c.sortField === sortField)?.label ?? sortField}{" "}
              in {sortDirection === "asc" ? "ascending" : "descending"} order.
              Page {currentPage} of {totalPages}.
            </caption>
            <thead>
              <tr className="border-b border-white/10">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSortFor(col.sortField)}
                    style={cellStyle(col.key)}
                    className={cn(
                      "px-4 py-3 font-medium text-white/60",
                      col.align === "right" && "text-right",
                      pinned.includes(col.key) && "bg-[#0b0b0f]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        col.align === "right" && "justify-end"
                      )}
                    >
                      {col.sortField ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.sortField as SortField)}
                          className="inline-flex items-center gap-1 transition hover:text-white"
                          aria-label={`Sort by ${col.label}`}
                        >
                          {col.label}
                          {sortField === col.sortField &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            ))}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                      {col.definition && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`About ${col.label}: units, time window and direction`}
                                aria-describedby={`metric-definition-${col.key}`}
                                className="rounded-full text-white/40 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              >
                                <Info
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-[min(16rem,calc(100vw-2rem))] whitespace-normal text-left"
                            >
                              {col.definition}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePin(col.key)}
                        aria-label={
                          pinned.includes(col.key)
                            ? `Unpin ${col.label} column`
                            : `Pin ${col.label} column`
                        }
                        className="text-white/30 transition hover:text-white"
                      >
                        {pinned.includes(col.key) ? (
                          <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {pagedProviders.map((provider: SignalProvider) => (
                <tr
                  key={provider.address}
                  onClick={() => openProviderProfile(provider.address)}
                  className="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-white/70" style={cellStyle("rank")}>
                    {provider.rank}
                  </td>
                  <td
                    className="px-4 py-3 text-white"
                    style={cellStyle("provider")}
                  >
                    <span aria-hidden="true">{truncateAddress(provider.address)}</span>
                    <span className="sr-only">{provider.address}</span>
                  </td>
                  <td
                    className="px-4 py-3 text-right text-white/70"
                    style={cellStyle("overallScore")}
                  >
                    {provider.overallScore}
                  </td>
                  <td
                    className="px-4 py-3 text-right text-white/70"
                    style={cellStyle("winRate")}
                  >
                    {provider.winRate}%
                  </td>

                  <td
                    className="px-4 py-3 text-right text-white/70"
                    style={cellStyle("recentPerformance")}
                  >
                    {provider.recentPerformance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <MetricDefinitions />

        {currentUser && currentUserPage && currentUserPage !== currentPage && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <span>
              You are ranked #{currentUser.rank} (page {currentUserPage}).
            </span>
            <button
              type="button"
              onClick={() => setPage(currentUserPage)}
              className="text-white underline-offset-2 hover:underline"
            >
              Go to my rank
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/70">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <ScrollToTop />
      </div>
    </PageTransition>
  );
}
