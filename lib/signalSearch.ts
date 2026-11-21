import type { Signal } from "./signals";

/** Common trading pairs offered as autocomplete suggestions before any data loads. */
export const COMMON_PAIRS = [
  "BTC/USD",
  "ETH/USD",
  "XLM/USD",
  "SOL/USD",
  "ADA/USD",
  "DOT/USD",
  "MATIC/USD",
  "ATOM/USD",
  "USDC/USD",
] as const;

export type SignalSearchSuggestionKind = "pair" | "provider" | "strategy";

export interface SignalSearchSuggestion {
  /** Stable key for React lists and keyboard navigation */
  id: string;
  kind: SignalSearchSuggestionKind;
  /** Text inserted into the search box when the suggestion is chosen */
  value: string;
  /** Optional secondary line (e.g. "Provider", "Strategy tag") */
  hint?: string;
}

/** Maximum number of suggestions rendered at once. */
export const MAX_SUGGESTIONS = 8;

/** Maximum number of recent searches kept in local storage. */
export const MAX_RECENT_SEARCHES = 6;

const KIND_ORDER: Record<SignalSearchSuggestionKind, number> = {
  pair: 0,
  provider: 1,
  strategy: 2,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Derives the pair label for a signal, e.g. "BTC" -> "BTC/USD". */
export function pairForTicker(ticker: string): string {
  const upper = ticker.trim().toUpperCase();
  if (!upper) return "";
  return upper.includes("/") ? upper : `${upper}/USD`;
}

/**
 * Builds ranked autocomplete suggestions from the loaded signals plus the
 * static list of common pairs. Matches pairs, provider names and strategy tags
 * (falling back to the signal description when no tags are present).
 */
export function buildSignalSearchSuggestions(
  signals: Signal[],
  query: string,
  limit: number = MAX_SUGGESTIONS
): SignalSearchSuggestion[] {
  const q = normalize(query);
  const seen = new Set<string>();
  const suggestions: SignalSearchSuggestion[] = [];

  const push = (kind: SignalSearchSuggestionKind, value: string, hint?: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = `${kind}:${normalize(trimmed)}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ id: key, kind, value: trimmed, hint });
  };

  const pairs = new Set<string>(COMMON_PAIRS);
  const providers = new Set<string>();
  const strategies = new Set<string>();

  for (const signal of signals) {
    const pair = pairForTicker(signal.ticker);
    if (pair) pairs.add(pair);
    if (signal.provider) providers.add(signal.provider);
    const tags = (signal as Signal & { tags?: string[] }).tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) if (typeof tag === "string") strategies.add(tag);
    }
  }

  const matches = (value: string) => !q || normalize(value).includes(q);

  for (const pair of pairs) if (matches(pair)) push("pair", pair, "Pair");
  for (const provider of providers) if (matches(provider)) push("provider", provider, "Provider");
  for (const strategy of strategies) if (matches(strategy)) push("strategy", strategy, "Strategy");

  return suggestions
    .sort((a, b) => {
      const aStarts = normalize(a.value).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.value).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    })
    .slice(0, limit);
}

/** Adds a query to the front of the recent-search list, de-duplicated and capped. */
export function addRecentSearch(
  recent: string[],
  query: string,
  max: number = MAX_RECENT_SEARCHES
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return recent;
  const lower = normalize(trimmed);
  return [trimmed, ...recent.filter((entry) => normalize(entry) !== lower)].slice(0, max);
}

/** Removes a single query from the recent-search list. */
export function removeRecentSearch(recent: string[], query: string): string[] {
  const lower = normalize(query);
  return recent.filter((entry) => normalize(entry) !== lower);
}

/**
 * Whether a signal matches a free-text query across ticker/pair, provider,
 * strategy tags and description.
 */
export function signalMatchesQuery(signal: Signal, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const tags = (signal as Signal & { tags?: string[] }).tags;
  const haystack = [
    signal.ticker,
    pairForTicker(signal.ticker),
    signal.provider ?? "",
    signal.details,
    ...(Array.isArray(tags) ? tags : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
