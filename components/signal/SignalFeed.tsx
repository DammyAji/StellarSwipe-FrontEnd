"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { InfiniteData } from "@tanstack/query-core";
import { Button } from "@/components/ui/button";
import { SignalEmptyState } from "@/components/SignalEmptyState";
import { SignalCardSkeleton } from "@/components/SignalCardSkeleton";
import { SignalFeedFilters } from "@/components/SignalFeedFilters";
import { SignalSortControls } from "@/components/SignalSortControls";
import { SignalFilterBottomSheet } from "@/components/SignalFilterBottomSheet";
import { PricePrecisionToggle } from "@/components/PricePrecisionToggle";
import { FeedDensityToggle, FeedLayoutToggle } from "@/components/FeedDensityToggle";
import { useFeedDensityStore } from "@/store/useFeedDensityStore";
import { ExpiredSignalBanner } from "@/components/ExpiredSignalBanner";
import { useSignalFilterStore } from "@/store/useSignalFilterStore";
import { useToastStore } from "@/store/useToastStore";
import { useFollowedProvidersStore } from "@/store/useFollowedProvidersStore";
import { useRecentlyViewedStore } from "@/store/useRecentlyViewedStore";
import { useSnoozeStore } from "@/store/useSnoozeStore";
import { useSignalExpiryStore } from "@/store/useSignalExpiryStore";
import { useSignalExpiryWorker } from "@/hooks/useSignalExpiryWorker";
import { selectActiveSignals } from "@/lib/signalExpiry";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";
import type { Signal } from "@/lib/signals";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { RelativeTimestamp } from "@/components/RelativeTimestamp";
import { NetworkErrorState } from "@/components/NetworkErrorState";
import { useI18n } from "@/hooks/useI18n";
import { fetchSignals } from "@/lib/api";
import { queryOptions } from "@/lib/queryOptions";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync";
import { useSearchFilter } from "@/hooks/useSearchFilter";
import {
  readPersistedSplitRatio,
  persistSplitRatio,
  clampSplitRatio,
  computeSplitRatioFromClientX,
} from "@/lib/splitView";
import { deriveSignalFeedLoading, buildShimmerDelays } from "@/lib/signalFeedLoading";
import { PriceAlertForm } from "@/components/watchlist/PriceAlertForm";

interface SignalResponse {
  items: Signal[];
  page: number;
  pageSize: number;
  nextPage: number | null;
  hasMore: boolean;
}

const PAGE_SIZE = 10;
const DESKTOP_BREAKPOINT = "(min-width: 1024px)";
const MIN_LIST_PANE_WIDTH = 320;
const MIN_DETAIL_PANE_WIDTH = 340;
/** #1034: sessionStorage key holding the feed's saved scroll offset */
const FEED_POSITION_STORAGE_KEY = "signal-feed-scroll-position";

interface SignalFeedProps {
  /** Server-fetched first page — eliminates the client waterfall on initial load */
  initialData?: SignalResponse;
}

export function SignalFeed({ initialData }: SignalFeedProps = {}) {
  const { t } = useI18n();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  /** Ref for the search input so we can focus it via keyboard shortcut */
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // #727: keep filters in sync with shareable URL parameters
  useFilterUrlSync();

  const {
    direction,
    asset,
    provider,
    bookmarkedOnly,
    followedOnly,
    setFollowedOnly,
    reset: resetFilters,
  } = useSignalFilterStore();
  const followedProviders = useFollowedProvidersStore((s) => s.followedProviders);
  const density = useFeedDensityStore((s) => s.density);
  // #1033: card vs list presentation, persisted across navigation and reloads.
  const layout = useFeedDensityStore((s) => s.layout);
  const pruneExpiredSnoozes = useSnoozeStore((state) => state.pruneExpired);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const { addView } = useRecentlyViewedStore();
  // Bumped on a timer so expired snoozes are re-evaluated and signals return.
  const [snoozeTick, setSnoozeTick] = useState(0);

  // Track whether the last auto-load attempt failed so we can show the manual fallback
  const [autoLoadFailed, setAutoLoadFailed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  // Calculate viewport count for skeleton rendering (based on container height / estimated row height)
  const [viewportCount, setViewportCount] = useState(3);
  const [feedHeight, setFeedHeight] = useState(0);

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;
    const height = container.clientHeight;
    setFeedHeight(height);
    const rowHeight = layout === "list" ? 96 : density === "compact" ? 180 : 280;
    setViewportCount(Math.max(1, Math.ceil(height / rowHeight)));
  }, [density, layout]);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    refetch,
  } = useInfiniteQuery<
    SignalResponse,
    Error,
    InfiniteData<SignalResponse, number>
  >({
    queryKey: ["signals"],
    queryFn: async ({ pageParam = 1, signal }) => {
      // Use fetchSignals so absolute base URL is prepended correctly for MSW testing environments.
      // Forwarding `signal` lets React Query actually cancel the in-flight
      // request (not just ignore its result) when it's superseded or the
      // owning view is torn down.
      return fetchSignals({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        signal,
      }) as Promise<SignalResponse>;
    },
    getNextPageParam: (lastPage: SignalResponse) => lastPage.nextPage,
    initialPageParam: 1,
    staleTime: queryOptions.signal.staleTime,
    placeholderData: (prev) => prev,
    // Seed the cache with the server-fetched first page so no client waterfall occurs
    ...(initialData && {
      initialData: {
        pages: [initialData],
        pageParams: [1],
      },
    }),
  });

  const allSignals = useMemo<Signal[]>(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  // Expiry runs on its own schedule; expired signals drop out of the active feed.
  const expiredSignals = useSignalExpiryStore((state) => state.expired);
  useSignalExpiryWorker(allSignals);
  const activeSignals = useMemo(
    () => selectActiveSignals(allSignals, expiredSignals),
    [allSignals, expiredSignals]
  );

  const availableProviders = useMemo(
    () => [...new Set(allSignals.map((s) => s.ticker))].sort(),
    [allSignals]
  );

  const availableAssets = useMemo(
    () => [...new Set(allSignals.map((s) => s.ticker))].sort(),
    [allSignals]
  );

  // #657 + #685: useSearchFilter centralises debounced search + filter logic.
  const {
    searchValue: providerSearch,
    setSearchValue: handleProviderSearch,
    clearSearch,
    filteredSignals: signals,
    filteredCount,
    hasActiveFilters,
    querySignature,
  } = useSearchFilter({ signals: activeSignals, snoozeTick });

  // #1036: one-action reset for every non-default feed filter.
  const enqueueToast = useToastStore((s) => s.enqueue);
  const handleResetFilters = useCallback(() => {
    resetFilters();
    clearSearch();
    enqueueToast({
      tone: "info",
      title: "Filters reset",
      description: "Showing the default signal feed.",
      duration: 4000,
    });
    refetch();
  }, [resetFilters, clearSearch, enqueueToast, refetch]);

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId) ?? null,
    [signals, selectedSignalId]
  );

  // Other active signals for the same asset, drawn from the loaded feed pages
  const relatedSignals = useMemo<Signal[]>(
    () =>
      selectedSignal
        ? allSignals.filter(
            (signal) =>
              signal.ticker === selectedSignal.ticker &&
              signal.id !== selectedSignal.id &&
              signal.status === "Active"
          )
        : [],
    [allSignals, selectedSignal]
  );

  const feedLoadingState = useMemo(
    () =>
      deriveSignalFeedLoading({
        itemCount: allSignals.length,
        isInitialLoading: isLoading,
        isFetchingNextPage,
        hasNextPage: !!hasNextPage,
        viewportCount,
      }),
    [allSignals.length, isLoading, isFetchingNextPage, hasNextPage, viewportCount]
  );

  const shimmerDelays = useMemo(
    () => buildShimmerDelays(feedLoadingState.skeletonCount),
    [feedLoadingState.skeletonCount]
  );

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  // Virtual row configuration - estimate height based on typical signal card
  const estimatedRowHeight = layout === "list" ? 96 : 280;

  const virtualizer = useVirtualizer({
    count: signals.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    scrollMargin: 100,
    getItemKey: useCallback(
      (index: number) => signals[index]?.id ?? index,
      [signals]
    ),
  });

  // #1033: re-measure rows when the presentation changes so list rows collapse
  // to their real height instead of keeping the card estimate.
  useEffect(() => {
    virtualizer.measure();
  }, [layout, density, virtualizer]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const syncStatus = useSyncStatus(isFetching);

  // Pull-to-refresh gesture handler
  const handlePullRefresh = useCallback(() => {
    // Refetch the first page when pull-to-refresh is triggered
    refetch();
  }, [refetch]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    container: scrollEl,
    onRefresh: handlePullRefresh,
    disabled: isLoading, // Disable while initial load is in flight
  });

  // #657: Cmd/Ctrl+K focuses the search bar from anywhere on the feed
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
    const updateDesktopMode = () => setIsDesktop(mediaQuery.matches);

    setSplitRatio(readPersistedSplitRatio(window.localStorage));
    updateDesktopMode();
    mediaQuery.addEventListener("change", updateDesktopMode);

    return () => {
      mediaQuery.removeEventListener("change", updateDesktopMode);
    };
  }, []);

  useEffect(() => {
    if (!signals.length) {
      setSelectedSignalId(null);
      return;
    }

    if (
      !selectedSignalId ||
      !signals.some((signal) => signal.id === selectedSignalId)
    ) {
      setSelectedSignalId(signals[0]!.id);
    }
  }, [signals, selectedSignalId]);

  const updateSplitRatio = useCallback((nextRatio: number) => {
    const clamped = clampSplitRatio(nextRatio);
    setSplitRatio(clamped);
    if (typeof window !== "undefined") {
      persistSplitRatio(window.localStorage, clamped);
    }
  }, []);

  const handleSplitDragStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!splitContainerRef.current) return;

      event.preventDefault();
      const container = splitContainerRef.current;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const nextRatio = computeSplitRatioFromClientX(
          moveEvent.clientX,
          rect.left,
          rect.width,
          MIN_LIST_PANE_WIDTH,
          MIN_DETAIL_PANE_WIDTH
        );
        updateSplitRatio(nextRatio);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateSplitRatio]
  );

  const handleSplitHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -0.03 : 0.03;
      updateSplitRatio(splitRatio + delta);
    },
    [splitRatio, updateSplitRatio]
  );

  // Custom scroll restoration for the virtualized container
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    // Save scroll position on unmount
    const handleScroll = () => {
      try {
        sessionStorage.setItem(FEED_POSITION_STORAGE_KEY, container.scrollTop.toString());
      } catch (e) {
        // Ignore storage errors
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      // Save final position on unmount
      try {
        sessionStorage.setItem(FEED_POSITION_STORAGE_KEY, container.scrollTop.toString());
      } catch (e) {
        // Ignore storage errors
      }
    };
  }, []);

  // #1034: remember which query the saved position belongs to, so a query
  // change starts the feed from the top instead of restoring a stale offset.
  const lastQuerySignatureRef = useRef(querySignature);
  useEffect(() => {
    if (lastQuerySignatureRef.current === querySignature) return;
    lastQuerySignatureRef.current = querySignature;
    try {
      sessionStorage.removeItem(FEED_POSITION_STORAGE_KEY);
    } catch (e) {
      // Ignore storage errors
    }
    const container = parentRef.current;
    if (container) container.scrollTop = 0;
  }, [querySignature]);

  // #1034: restore the saved offset once the virtualized list has rendered
  // enough rows to make that offset reachable. Focus is never moved here.
  const restoredPositionRef = useRef(false);
  useEffect(() => {
    if (restoredPositionRef.current) return;
    const container = parentRef.current;
    if (!container || signals.length === 0) return;

    let savedPosition = 0;
    try {
      savedPosition = parseInt(
        sessionStorage.getItem(FEED_POSITION_STORAGE_KEY) ?? "0",
        10
      );
    } catch (e) {
      savedPosition = 0;
    }
    if (!Number.isFinite(savedPosition) || savedPosition <= 0) {
      restoredPositionRef.current = true;
      return;
    }

    // Wait until the virtualizer has measured enough rows to reach the offset.
    if (container.scrollHeight - container.clientHeight < savedPosition) return;

    container.scrollTop = savedPosition;
    restoredPositionRef.current = true;
  }, [signals.length, virtualizer, hasNextPage, isFetchingNextPage, loadMore]);

  // #321: periodically drop expired snoozes so snoozed signals are
  // automatically returned to the feed once their snooze period elapses.
  useEffect(() => {
    const interval = setInterval(() => {
      pruneExpiredSnoozes();
      setSnoozeTick((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [pruneExpiredSnoozes]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      setAutoLoadFailed(false);
      fetchNextPage().catch(() => setAutoLoadFailed(true));
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Manual fallback: called from the button when auto-scroll failed
  const handleManualLoadMore = useCallback(() => {
    setAutoLoadFailed(false);
    fetchNextPage().catch(() => setAutoLoadFailed(true));
  }, [fetchNextPage]);

  useEffect(() => {
    const element = sentinelRef.current;
    // If auto-load previously failed, don't re-trigger via IntersectionObserver
    if (
      !element ||
      !scrollEl ||
      !hasNextPage ||
      isFetchingNextPage ||
      autoLoadFailed
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: scrollEl, rootMargin: "240px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, loadMore, autoLoadFailed, scrollEl]);

  return (
    <section
      ref={feedRef}
      aria-label="Signal feed"
      className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/10 sm:p-6"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-400/90">
            Signal feed
          </p>
          <h2 className="text-xl font-semibold sm:text-2xl md:text-3xl">
            Live market signals
          </h2>
          <p className="max-w-2xl text-sm text-slate-400">
            Browse the latest actionable signals with seamless infinite
            scrolling.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Sort controls — persistent across browsing */}
          <SignalSortControls />
          <div className="flex items-center gap-2">
            {/* Price precision toggle */}
            <PricePrecisionToggle />
            {/* Density toggle — persisted across sessions */}
            <FeedDensityToggle />
            {/* #1033: card/list layout toggle — persisted across sessions */}
            <FeedLayoutToggle />
          </div>
          {/* #574: last-updated / stale status, with a manual refresh action */}
          <div className="flex items-center gap-2">
            <SyncStatusIndicator status={syncStatus} />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                aria-label="Reset all signal filters to defaults"
                className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200 transition-colors hover:border-sky-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Reset filters
              </button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh signal feed"
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Refresh
            </button>
          </div>
          {/* #98: show consistent loading state */}
          <div
            className="text-right text-sm text-foreground-muted"
            aria-live="polite"
            aria-atomic="true"
          >
            {feedLoadingState.ariaBusy && !allSignals.length
              ? "Loading signals..."
              : feedLoadingState.ariaBusy
              ? "Refreshing..."
              : "Scroll down to load more."}
          </div>
        </div>
      </div>

      {/* #657: Search bar — prominent, sticky, with Cmd/Ctrl+K shortcut hint */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-slate-950/95 px-4 pt-2 pb-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="relative flex items-center">
          <Search
            size={14}
            className="absolute left-3 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={providerSearch}
            onChange={(e) => handleProviderSearch(e.target.value)}
            placeholder="Search ticker, provider or signal… (⌘K)"
            aria-label="Search signals by ticker, provider or description"
            className="w-full rounded-full border border-white/15 bg-white/8 pl-8 pr-10 py-2 text-sm text-gray-200 placeholder-gray-500 shadow-sm shadow-slate-950/30 transition-all hover:border-white/25 focus:border-sky-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
          {providerSearch ? (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={13} />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="absolute right-3 hidden items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:flex"
            >
              ⌘K
            </kbd>
          )}
        </div>
        {/* Live result count below the search bar */}
        <p
          className="mt-1.5 text-[11px] text-slate-500"
          aria-live="polite"
          aria-atomic="true"
        >
          {providerSearch
            ? t("signals.matching_count", {
                count: filteredCount,
                query: providerSearch,
              })
            : hasActiveFilters
            ? `${filteredCount} result${filteredCount !== 1 ? "s" : ""} match your filters`
            : null}
        </p>
      </div>

      {/* Filters — desktop: inline panel; mobile: bottom sheet trigger */}
      <div className="mb-4">
        {/* Mobile filter trigger button */}
        <div className="flex items-center gap-2 sm:hidden mb-3">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Open signal filters"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/20 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Filters
            {hasActiveFilters && (
              <span
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white transition-transform animate-in zoom-in-75 duration-150"
                aria-label={`${
                  [
                    direction !== "ALL",
                    asset !== "",
                    provider !== "",
                    bookmarkedOnly,
                    followedOnly,
                    providerSearch.trim() !== "",
                  ].filter(Boolean).length
                } active filters`}
              >
                {
                  [
                    direction !== "ALL",
                    asset !== "",
                    provider !== "",
                    bookmarkedOnly,
                    followedOnly,
                    providerSearch.trim() !== "",
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>
        </div>

        {/* Desktop: inline filter panel */}
        <div className="hidden sm:block">
          <SignalFeedFilters
            availableAssets={availableAssets}
            availableProviders={availableProviders}
            filteredCount={filteredCount}
          />
        </div>
      </div>

      {/* Recently Viewed Strip */}
      <RecentlyViewedStrip />

      {/* #1028: first-session walkthrough anchor — a deliberate decision point
          that never submits a trade. */}
      <div
        data-tour="feed-decide"
        className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground-muted"
      >
        <span className="font-semibold text-foreground">Deciding?</span>
        <span>
          Bookmark, compare or dismiss a signal — no trade is placed from this
          walkthrough.
        </span>
      </div>

      {/* Mobile bottom sheet */}
      <SignalFilterBottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        availableProviders={availableProviders}
        availableMarkets={availableAssets}
      />

      <div
        ref={splitContainerRef}
        className="lg:grid lg:items-start lg:gap-0"
        style={
          isDesktop
            ? {
                gridTemplateColumns: `${(splitRatio * 100).toFixed(
                  2
                )}% 10px minmax(${MIN_DETAIL_PANE_WIDTH}px, 1fr)`,
              }
            : undefined
        }
      >
        <div className="min-w-0">
          <div
            ref={(el) => {
              setScrollEl(el);
              parentRef.current = el;
            }}
            className="max-h-[70vh] overflow-auto"
            role="feed"
            aria-busy={feedLoadingState.ariaBusy}
            aria-label="Signal list"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              const articles = Array.from(
                (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
                  "article[tabindex]"
                )
              );
              const idx = articles.indexOf(
                document.activeElement as HTMLElement
              );
              if (idx === -1) return;
              e.preventDefault();
              const next =
                e.key === "ArrowDown" ? articles[idx + 1] : articles[idx - 1];
              next?.focus();
            }}
          >
            {feedLoadingState.showInitialSkeletons ? (
              <div
                className="space-y-4"
                role="status"
                aria-label="Loading signal feed"
                aria-live="polite"
              >
                <span className="sr-only">Loading signal feed…</span>
                {shimmerDelays.map((delay, index) => (
                  <SignalCardSkeleton
                    key={index}
                    density={density}
                    animationDelay={delay}
                  />
                ))}
              </div>
            ) : isError && signals.length === 0 ? (
              <NetworkErrorState
                context="signals"
                onRetry={() => refetch()}
              />
            ) : !isError && signals.length === 0 ? (
              followedOnly && followedProviders.length === 0 ? (
                <SignalEmptyState
                  variant="no-followed"
                  onRefresh={() => refetch()}
                  onClearFilters={() => setFollowedOnly(false)}
                />
              ) : (
                <SignalEmptyState
                  variant={hasActiveFilters ? "no-results" : "no-signals"}
                  onRefresh={() => refetch()}
                  onClearFilters={hasActiveFilters ? handleResetFilters : undefined}
                />
              )
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const signal = signals[virtualRow.index];
                  const isExpired =
                    !!signal.expiresAt &&
                    new Date(signal.expiresAt) < new Date();

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <article
                        tabIndex={0}
                        data-tour={
                          virtualRow.index === 0 ? "feed-review" : undefined
                        }
                        onClick={() => {
                          addView(signal.id);
                          setSelectedSignalId(signal.id);
                        }}
                        aria-label={`${signal.ticker} ${
                          signal.action
                        } signal, ${signal.confidence}% confidence${
                          signal.provider ? `, provider ${signal.provider}` : ""
                        }${signal.status ? `, status ${signal.status}` : ""}${
                          isExpired ? ", expired" : ""
                        }. Use arrow keys to navigate between signals.`}
                        data-density={density}
                        data-layout={layout}
                        className={`border border-white/10 bg-slate-950/90 shadow-sm shadow-slate-950/20 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                          layout === "list"
                            ? "mb-2 rounded-xl p-3 sm:p-4"
                            : `rounded-3xl ${
                                density === "compact"
                                  ? "p-2 sm:p-3 mb-2"
                                  : "p-4 sm:p-6 mb-4"
                              }`
                        }`}
                      >
                        {isExpired && (
                          <div className="mb-3">
                            <ExpiredSignalBanner onRefresh={() => refetch()} />
                          </div>
                        )}

                        <div className="mb-3">
                          <SignalCard
                            pair={`${signal.ticker}/USDC`}
                            action={signal.action === "SELL" ? "SELL" : "BUY"}
                            confidence={signal.confidence}
                            analysis={signal.details}
                            timestamp={new Date(signal.timestamp)}
                            providerName={signal.provider}
                            expired={isExpired}
                          />
                        </div>

                        <div
                          className={
                            isExpired
                              ? "opacity-60 pointer-events-none select-none"
                              : ""
                          }
                          aria-hidden={isExpired}
                        >
                          <div
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${
                              layout === "list"
                                ? "gap-2"
                                : density === "compact"
                                ? "gap-2"
                                : "gap-4"
                            }`}
                          >
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-foreground-muted">
                                <time dateTime={signal.timestamp}>
                                  <RelativeTimestamp
                                    timestamp={new Date(signal.timestamp)}
                                  />
                                </time>
                              </p>
                              <h3 className="mt-2 text-base font-semibold tracking-tight text-white sm:text-xl">
                                {signal.ticker} • {signal.action}
                              </h3>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {signal.provider && (
                                  <span
                                    className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 ring-1 ring-inset ring-sky-500/20"
                                    aria-label={`Provider: ${signal.provider}`}
                                  >
                                    {signal.provider}
                                  </span>
                                )}
                                {signal.status && (
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                                      signal.status === "Active"
                                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                                        : signal.status === "Waiting"
                                        ? "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                                        : "bg-slate-500/10 text-slate-400 ring-slate-500/20"
                                    }`}
                                    aria-label={`Status: ${signal.status}`}
                                  >
                                    {signal.status}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div
                              className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-sky-300 sm:px-4 sm:py-2 sm:text-sm"
                              aria-label={`Confidence: ${signal.confidence} percent`}
                            >
                              Confidence {signal.confidence}%
                            </div>
                          </div>
                          <p
                            className={`text-sm leading-6 text-foreground-muted ${
                              layout === "list"
                                ? "mt-2 line-clamp-2"
                                : density === "compact"
                                ? "mt-2"
                                : "mt-4"
                            }`}
                          >
                            {signal.details}
                          </p>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            )}

            {hasNextPage && (
              <div
                ref={sentinelRef}
                aria-hidden="true"
                className="h-px w-full"
              />
            )}

            {feedLoadingState.showPaginationSkeleton && (
              <div aria-hidden="true" className="mt-4">
                <SignalCardSkeleton density={density} />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            {isFetchingNextPage && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground-muted"
              >
                Loading more signals...
              </div>
            )}

            {!hasNextPage && signals.length > 0 && (
              <p
                className="text-center text-sm text-foreground-subtle"
                aria-live="polite"
              >
                You&apos;ve reached the end of the feed.
              </p>
            )}

            {hasNextPage && (autoLoadFailed || !isFetchingNextPage) && (
              <div className="flex flex-col items-center gap-2">
                {autoLoadFailed && (
                  <p
                    className="text-xs text-amber-400"
                    role="alert"
                    aria-live="assertive"
                  >
                    Auto-load failed. Load more manually.
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={handleManualLoadMore}
                  disabled={isFetchingNextPage}
                  aria-label={
                    isFetchingNextPage
                      ? "Loading more signals"
                      : "Load more signals"
                  }
                >
                  {isFetchingNextPage ? "Loading more..." : "Load more signals"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {isDesktop && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize feed and detail panes"
              aria-valuenow={Math.round(splitRatio * 100)}
              aria-valuemin={30}
              aria-valuemax={70}
              tabIndex={0}
              onMouseDown={handleSplitDragStart}
              onKeyDown={handleSplitHandleKeyDown}
              className="mx-1 hidden h-full min-h-[70vh] cursor-col-resize rounded-full border border-white/10 bg-white/5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:block"
            />
            <aside
              aria-label="Selected signal details"
              data-tour="feed-details"
              className="hidden min-h-[70vh] rounded-2xl border border-white/10 bg-slate-950/70 p-4 lg:block"
            >
              {selectedSignal ? (
                <div className="space-y-4" tabIndex={0}>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-400/80">
                    Selected signal
                  </p>
                  <h3 className="text-2xl font-semibold text-white">
                    {selectedSignal.ticker} • {selectedSignal.action}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-300">
                      Confidence {selectedSignal.confidence}%
                    </span>
                    {selectedSignal.provider && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-foreground-muted">
                        Provider: {selectedSignal.provider}
                      </span>
                    )}
                    {selectedSignal.status && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-foreground-muted">
                        Status: {selectedSignal.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-foreground-muted">
                    {selectedSignal.details}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    Published{" "}
                    <RelativeTimestamp
                      timestamp={new Date(selectedSignal.timestamp)}
                    />
                    .
                  </p>
                  <section
                    aria-label="Related active signals"
                    className="space-y-2 border-t border-white/10 pt-4"
                  >
                    <h4 className="text-xs uppercase tracking-[0.3em] text-sky-400/80">
                      Related active signals
                    </h4>
                    {isLoading ? (
                      <p role="status" className="text-xs text-foreground-muted">
                        Loading related signals...
                      </p>
                    ) : isError ? (
                      <p role="alert" className="text-xs text-red-400">
                        Could not load related signals.
                      </p>
                    ) : relatedSignals.length === 0 ? (
                      <p className="text-xs text-foreground-muted">
                        No other active signals for {selectedSignal.ticker}.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {relatedSignals.map((related) => (
                          <li key={related.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedSignalId(related.id)}
                              aria-label={`View ${related.ticker} ${related.action} from ${related.provider ?? "unknown provider"}`}
                              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs hover:border-sky-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            >
                              <span className="font-semibold text-white">
                                {related.ticker} • {related.action}
                              </span>
                              <span className="text-foreground-muted">
                                Provider: {related.provider ?? "Unknown"}
                              </span>
                              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                                Status: {related.status}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section
                    aria-label="Price movement alerts"
                    className="space-y-2 border-t border-white/10 pt-4"
                  >
                    <h4 className="text-xs uppercase tracking-[0.3em] text-sky-400/80">
                      Price movement alerts
                    </h4>
                    <PriceAlertForm
                      key={selectedSignal.id}
                      symbol={selectedSignal.ticker}
                      initialThreshold={selectedSignal.quote?.price ?? null}
                    />
                  </section>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-foreground-muted">
                  Select a signal from the list to view details.
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </section>
  );
}
