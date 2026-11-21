"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Signal } from "@/lib/signals";
import { signalMatchesQuery } from "@/lib/signalSearch";
import {
  useSignalFilterStore,
  useSignalFilterHydrated,
} from "@/store/useSignalFilterStore";
import { useBookmarkStore } from "@/store/useBookmarkStore";
import { useFollowedProvidersStore } from "@/store/useFollowedProvidersStore";
import { useSnoozeStore, selectVisibleSignals } from "@/store/useSnoozeStore";
import { usePinnedSignalsStore } from "@/store/usePinnedSignalsStore";
import { applyPins } from "@/lib/pinnedSignals";

/** Default debounce delay in ms — short enough to feel instant, long enough to skip mid-keystroke renders */
const DEBOUNCE_MS = 150;

export interface UseSearchFilterOptions {
  /** All signals from the infinite-query result */
  signals: Signal[];
  /** Delay in ms before the search term is applied (default: 150) */
  debounceMs?: number;
  /** Tick counter from snooze pruning — changing it forces re-evaluation of visible signals */
  snoozeTick?: number;
}

export interface UseSearchFilterResult {
  /** The raw, instantly-updated search input value (bind to `<input value>`) */
  searchValue: string;
  /** Setter for the search input — updates both the UI and the filter store atomically */
  setSearchValue: (v: string) => void;
  /** Clear just the free-text search */
  clearSearch: () => void;
  /** Number of signals that survive all active filters */
  filteredCount: number;
  /** Whether any filter (direction, asset, provider, bookmarked, search) is active */
  hasActiveFilters: boolean;
  /** The fully-filtered, sorted signal list */
  filteredSignals: Signal[];
  /** Stable signature of every active filter — changes whenever the query changes */
  querySignature: string;
}

/**
 * useSearchFilter
 *
 * Centralises the search + filter logic previously duplicated in SignalFeed.
 * Debounces the free-text query, reads the rest of the filters from the
 * global SignalFilterStore, and returns a `filteredSignals` array plus
 * derived metadata (filteredCount, hasActiveFilters).
 *
 * @example
 * ```tsx
 * const { searchValue, setSearchValue, filteredSignals, filteredCount, hasActiveFilters } =
 *   useSearchFilter({ signals: allSignals, snoozeTick });
 * ```
 */
export function useSearchFilter({
  signals,
  debounceMs = DEBOUNCE_MS,
  snoozeTick = 0,
}: UseSearchFilterOptions): UseSearchFilterResult {
  const {
    direction,
    asset,
    provider,
    sortOrder,
    bookmarkedOnly,
    followedOnly,
    setProvider,
  } = useSignalFilterStore();
  const isHydrated = useSignalFilterHydrated();

  const bookmarkedIds = useBookmarkStore((s) => s.bookmarks);
  const followedProviders = useFollowedProvidersStore((s) => s.followedProviders);
  const snoozedMap = useSnoozeStore((s) => s.snoozed);
  // #1097: pinned signals are hoisted to the top of the feed without changing
  // the global sort order or breaking pagination.
  const pinnedIds = usePinnedSignalsStore((s) => s.pinnedIds);

  // searchValue is the immediate, unthrottled input state
  const [searchValue, setSearchValueState] = useState(provider);
  // debouncedSearch is the value actually used for filtering
  const [debouncedSearch, setDebouncedSearch] = useState(provider);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local search value in sync when the store's provider value changes
  // externally (URL restore, preset apply, reset, etc.)
  useEffect(() => {
    setSearchValueState((current) =>
      current === provider ? current : provider
    );
  }, [provider]);

  // Debounce: whenever searchValue changes, schedule a deferred update to debouncedSearch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(searchValue),
      debounceMs
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, debounceMs]);

  /** Update both local state and filter store together */
  const setSearchValue = useCallback(
    (v: string) => {
      setSearchValueState(v);
      setProvider(v);
    },
    [setProvider]
  );

  const clearSearch = useCallback(() => setSearchValue(""), [setSearchValue]);

  const filteredSignals = useMemo<Signal[]>(() => {
    // While the store is still hydrating, return the empty list so the UI
    // doesn't flash stale default-state results before persisted filters load.
    if (!isHydrated) return [];

    let filtered = [...signals];
    const searchTerm = debouncedSearch.trim().toLowerCase();

    if (direction !== "ALL") {
      filtered = filtered.filter((s) => s.action === direction);
    }

    if (asset.trim()) {
      const q = asset.trim().toLowerCase();
      filtered = filtered.filter((s) => s.ticker.toLowerCase().includes(q));
    }

    if (provider.trim()) {
      const q = provider.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          (s.provider ?? "").toLowerCase().includes(q)
      );
    }

    if (searchTerm) {
      // #156: search covers pairs, providers, strategy tags and descriptions.
      filtered = filtered.filter(
        (s) =>
          signalMatchesQuery(s, searchTerm) ||
          s.action.toLowerCase().includes(searchTerm)
      );
    }

    if (bookmarkedOnly) {
      filtered = filtered.filter((s) => bookmarkedIds.includes(s.id));
    }

    if (followedOnly) {
      filtered = filtered.filter(
        (s) => s.provider !== undefined && followedProviders.includes(s.provider)
      );
    }

    // Hide snoozed signals; snoozeTick causes this to re-run once snoozes expire
    filtered = selectVisibleSignals(filtered, snoozedMap);

    // Apply sort order
    const copy = [...filtered];
    if (sortOrder === "latest") {
      copy.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } else if (sortOrder === "hot") {
      copy.sort(
        (a, b) =>
          b.confidence - a.confidence ||
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } else if (sortOrder === "confidence") {
      copy.sort((a, b) => b.confidence - a.confidence);
    } else if (sortOrder === "relevant") {
      const actionWeight = (s: Signal) => (s.action === "HOLD" ? 0 : 1);
      copy.sort(
        (a, b) =>
          actionWeight(b) - actionWeight(a) || b.confidence - a.confidence
      );
    }

    // #1097: hoist pinned signals to the top after all filtering and sorting,
    // so the global sort order is preserved for the rest of the feed and
    // pagination is unaffected. Missing pins are ignored, never fabricated.
    const pinned = applyPins(copy, pinnedIds);

    return pinned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    signals,
    isHydrated,
    direction,
    asset,
    provider,
    debouncedSearch,
    bookmarkedOnly,
    bookmarkedIds,
    followedOnly,
    followedProviders,
    snoozedMap,
    snoozeTick,
    sortOrder,
    pinnedIds,
  ]);

  const hasActiveFilters =
    direction !== "ALL" ||
    asset !== "" ||
    provider !== "" ||
    bookmarkedOnly ||
    followedOnly ||
    searchValue.trim() !== "";

  // #1034: a single string that changes whenever the effective query changes,
  // so consumers can reset saved feed state without deep-comparing filters.
  const querySignature = [
    direction,
    asset,
    provider,
    debouncedSearch,
    bookmarkedOnly ? "1" : "0",
    followedOnly ? "1" : "0",
    sortOrder,
  ].join("|");

  return {
    searchValue,
    setSearchValue,
    clearSearch,
    filteredCount: filteredSignals.length,
    hasActiveFilters,
    filteredSignals,
    querySignature,
  };
}
