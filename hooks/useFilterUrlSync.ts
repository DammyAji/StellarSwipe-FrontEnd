"use client";

import { useEffect, useRef } from "react";
import {
  useSignalFilterStore,
  type FeedSortOrder,
  type FilterDirection,
  type SignalScope,
} from "@/store/useSignalFilterStore";

/** URL parameter names owned by the signal feed filters. */
export const FILTER_PARAMS = {
  direction: "dir",
  asset: "asset",
  provider: "q",
  bookmarkedOnly: "saved",
  followedOnly: "followed",
  sortOrder: "sort",
  scope: "scope",
} as const;

const DIRECTIONS: FilterDirection[] = ["ALL", "BUY", "SELL"];
const SORT_ORDERS: FeedSortOrder[] = [
  "latest",
  "hot",
  "relevant",
  "confidence",
];
const SCOPES: SignalScope[] = ["active", "archived", "all"];

type FilterValues = {
  direction: FilterDirection;
  asset: string;
  provider: string;
  bookmarkedOnly: boolean;
  followedOnly: boolean;
  sortOrder: FeedSortOrder;
  scope: SignalScope;
};

const DEFAULTS: FilterValues = {
  direction: "ALL",
  asset: "",
  provider: "",
  bookmarkedOnly: false,
  followedOnly: false,
  sortOrder: "latest",
  scope: "active",
};

/** Maximum length kept for free-text parameters (asset / provider search). */
const MAX_TEXT_LENGTH = 120;

function readText(params: URLSearchParams, name: string): string {
  return (params.get(name) ?? "").trim().slice(0, MAX_TEXT_LENGTH);
}

/** Parses supported filters from a query string, ignoring invalid values. */
export function parseFilterParams(search: string): FilterValues {
  const params = new URLSearchParams(search);
  const dir = params.get(FILTER_PARAMS.direction)?.toUpperCase();
  const sort = params.get(FILTER_PARAMS.sortOrder)?.toLowerCase();
  const scope = params.get(FILTER_PARAMS.scope)?.toLowerCase();
  return {
    direction: DIRECTIONS.includes(dir as FilterDirection)
      ? (dir as FilterDirection)
      : DEFAULTS.direction,
    asset: readText(params, FILTER_PARAMS.asset),
    provider: readText(params, FILTER_PARAMS.provider),
    bookmarkedOnly: params.get(FILTER_PARAMS.bookmarkedOnly) === "1",
    followedOnly: params.get(FILTER_PARAMS.followedOnly) === "1",
    sortOrder: SORT_ORDERS.includes(sort as FeedSortOrder)
      ? (sort as FeedSortOrder)
      : DEFAULTS.sortOrder,
    scope: SCOPES.includes(scope as SignalScope)
      ? (scope as SignalScope)
      : DEFAULTS.scope,
  };
}

/**
 * Removes filter parameters that hold unsupported values so a shared link
 * with bad input is cleaned up instead of silently ignored.
 */
export function stripInvalidFilterParams(search: string): string {
  const params = new URLSearchParams(search);
  const dir = params.get(FILTER_PARAMS.direction);
  if (dir !== null && !DIRECTIONS.includes(dir.toUpperCase() as FilterDirection)) {
    params.delete(FILTER_PARAMS.direction);
  }
  const sort = params.get(FILTER_PARAMS.sortOrder);
  if (sort !== null && !SORT_ORDERS.includes(sort.toLowerCase() as FeedSortOrder)) {
    params.delete(FILTER_PARAMS.sortOrder);
  }
  const scope = params.get(FILTER_PARAMS.scope);
  if (scope !== null && !SCOPES.includes(scope.toLowerCase() as SignalScope)) {
    params.delete(FILTER_PARAMS.scope);
  }
  (["bookmarkedOnly", "followedOnly"] as const).forEach((key) => {
    const value = params.get(FILTER_PARAMS[key]);
    if (value !== null && value !== "1" && value !== "0") {
      params.delete(FILTER_PARAMS[key]);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Writes filters into `search`, touching only filter-owned parameters and
 * omitting defaults so URLs stay short and readable.
 */
export function serializeFilterParams(
  search: string,
  values: FilterValues
): string {
  const params = new URLSearchParams(search);
  (Object.keys(FILTER_PARAMS) as (keyof FilterValues)[]).forEach((key) => {
    const name = FILTER_PARAMS[key];
    const value = values[key];
    if (value === DEFAULTS[key]) {
      params.delete(name);
    } else {
      params.set(
        name,
        typeof value === "boolean"
          ? "1"
          : key === "direction"
            ? String(value).toLowerCase()
            : String(value)
      );
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function pickFilters(state: FilterValues): FilterValues {
  const {
    direction,
    asset,
    provider,
    bookmarkedOnly,
    followedOnly,
    sortOrder,
    scope,
  } = state;
  return {
    direction,
    asset,
    provider,
    bookmarkedOnly,
    followedOnly,
    sortOrder,
    scope,
  };
}

/**
 * Two-way sync between the signal filter store and the page URL so filtered
 * views can be shared, refreshed and navigated with back/forward.
 *
 * - On mount, filters present in the URL override persisted filters.
 * - Discrete filter changes push a history entry; free-text changes replace
 *   the current entry so typing doesn't flood the history stack.
 * - popstate / pageshow re-apply filters from the URL.
 * - Unsupported parameter values are dropped from the URL on load.
 */
export function useFilterUrlSync() {
  const applyingFromUrl = useRef(false);

  useEffect(() => {
    const applyFromUrl = () => {
      applyingFromUrl.current = true;
      useSignalFilterStore.setState(parseFilterParams(window.location.search));
      applyingFromUrl.current = false;
      // Drop unsupported values so the URL matches what is actually applied.
      const cleaned = stripInvalidFilterParams(window.location.search);
      if (cleaned !== window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${cleaned}${window.location.hash}`
        );
      }
    };

    const hasFilterParams = Object.values(FILTER_PARAMS).some((name) =>
      new URLSearchParams(window.location.search).has(name)
    );
    if (hasFilterParams) {
      applyFromUrl();
    } else {
      // Reflect persisted filters in the URL without adding a history entry.
      const next = serializeFilterParams(
        window.location.search,
        pickFilters(useSignalFilterStore.getState())
      );
      if (next !== window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${next}${window.location.hash}`
        );
      }
    }

    const unsubscribe = useSignalFilterStore.subscribe((state, prev) => {
      if (applyingFromUrl.current) return;
      const next = serializeFilterParams(
        window.location.search,
        pickFilters(state)
      );
      if (next === window.location.search) return;
      const url = `${window.location.pathname}${next}${window.location.hash}`;
      const textOnly =
        state.direction === prev.direction &&
        state.asset === prev.asset &&
        state.bookmarkedOnly === prev.bookmarkedOnly &&
        state.followedOnly === prev.followedOnly &&
        state.sortOrder === prev.sortOrder &&
        state.scope === prev.scope;
      if (textOnly) {
        window.history.replaceState(window.history.state, "", url);
      } else {
        window.history.pushState(window.history.state, "", url);
      }
    });

    window.addEventListener("popstate", applyFromUrl);
    // Back/forward cache restores the page without firing popstate.
    window.addEventListener("pageshow", applyFromUrl);
    return () => {
      unsubscribe();
      window.removeEventListener("popstate", applyFromUrl);
      window.removeEventListener("pageshow", applyFromUrl);
    };
  }, []);
}
