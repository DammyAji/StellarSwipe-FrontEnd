import { isPriceStale } from "./priceRefreshStatus";
import type { Quote, QuoteFreshness } from "./api-types.generated";

export type SignalAction = "BUY" | "SELL" | "HOLD";
export type SignalStatus = "Active" | "Waiting" | "Closed";

/** A single piece of supporting material supplied for a signal. */
export interface SignalEvidence {
  /** Human-readable label describing the evidence. */
  label: string;
  /** External URL to the source material or data reference. */
  url: string;
  /** Optional classification of the evidence source. */
  sourceType?: string;
}

export interface Signal {
  id: string;
  ticker: string;
  action: SignalAction;
  confidence: number;
  details: string;
  timestamp: string;
  /** ISO timestamp after which the signal is considered expired / no longer actionable */
  expiresAt?: string;
  /** Name of the signal provider */
  provider?: string;
  /** Current execution state of the signal */
  status?: SignalStatus;
  /** Price quote metadata; absent when the feed carries no price source. */
  quote?: Quote;
  /** Supporting evidence; absent when the feed supplies none. */
  evidence?: SignalEvidence[];
  /** True when the signal has been archived by its provider. */
  archived?: boolean;
}

/**
 * Returns `url` only when it parses as an absolute http(s) URL; otherwise null.
 * Callers must not render a link when this returns null.
 */
export function getSafeEvidenceUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.trim() === "") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface SignalFeedPage {
  items: Signal[];
  page: number;
  pageSize: number;
  total: number;
  nextPage: number | null;
  hasMore: boolean;
}

export interface SignalCursorPage {
  items: Signal[];
  pageSize: number;
  total: number;
  /** Opaque cursor for the next page; null when this is the last page */
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SignalFeedFilters {
  action?: SignalAction;
  ticker?: string;
  provider?: string;
  status?: SignalStatus;
}

/** Stable sort position of a signal: newest first, then id as tie-breaker */
type SignalPosition = Pick<Signal, "id" | "timestamp">;

const signalTickers = [
  "XLM",
  "BTC",
  "ETH",
  "USDC",
  "ADA",
  "SOL",
  "DOT",
  "MATIC",
  "ATOM",
  "LUNA",
];
const signalActions: SignalAction[] = ["BUY", "SELL", "HOLD"];
const signalStatuses: SignalStatus[] = ["Active", "Waiting", "Closed"];
const signalProviders = [
  "AlphaWave",
  "OrionSignals",
  "NebulaAI",
  "QuantPulse",
  "StellarEdge",
  "NovaTrade",
  "ZenithFX",
  "PolarSignals",
  "ApexQuant",
  "CosmicAlpha",
];
const signalDetails = [
  "Momentum building after a strong volume breakout.",
  "Price action suggests a reversal setup near support.",
  "Short-term indicators are aligned for a bullish move.",
  "Order flow shows growing demand on the bid side.",
  "Volatility contraction signals a potential breakout soon.",
  "Watch for a clean pullback into a high-probability zone.",
  "Liquidity is clustering around the current range.",
  "Trend strength remains intact on the higher time frame.",
  "A measured move target is shaping up on the chart.",
  "Market depth suggests a balanced buy/sell interest.",
];

const TOTAL_SIGNALS = 50;
// Signals older than this are considered expired (30 minutes)
const SIGNAL_TTL_MS = 30 * 60 * 1000;

/** Freshness of a quote observed at `observedAt` (epoch ms), using the price staleness threshold. */
export function classifyQuoteFreshness(
  observedAt: number | null,
  now: number = Date.now()
): QuoteFreshness {
  if (observedAt === null) return "unavailable";
  return isPriceStale(observedAt, now) ? "stale" : "fresh";
}

/**
 * Builds quote metadata. A missing price, observation time or source yields
 * `unavailable` with explicit nulls rather than a zero price.
 */
export function buildQuote(
  price: number | null,
  observedAt: number | null,
  source: string | null,
  now: number = Date.now()
): Quote {
  if (price === null || observedAt === null || source === null) {
    return {
      price: null,
      observedAt: null,
      source: null,
      freshness: "unavailable",
    };
  }
  return {
    price,
    observedAt: new Date(observedAt).toISOString(),
    source,
    freshness: classifyQuoteFreshness(observedAt, now),
  };
}

/** Newest first; id breaks ties so every signal has a unique, stable position. */
function compareSignalPositions(a: SignalPosition, b: SignalPosition): number {
  if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id > b.id ? 1 : -1;
}

/**
 * Reads the optional `action`, `ticker`, `provider` and `status` filters.
 * Empty values are ignored; returns null when `action` or `status` is unknown.
 */
export function parseSignalFeedFilters(
  params: URLSearchParams
): SignalFeedFilters | null {
  const action = params.get("action") || undefined;
  const status = params.get("status") || undefined;

  if (action !== undefined && !(signalActions as string[]).includes(action)) {
    return null;
  }
  if (status !== undefined && !(signalStatuses as string[]).includes(status)) {
    return null;
  }

  return {
    action: action as SignalAction | undefined,
    ticker: params.get("ticker") || undefined,
    provider: params.get("provider") || undefined,
    status: status as SignalStatus | undefined,
  };
}

function matchesFilters(signal: Signal, filters: SignalFeedFilters): boolean {
  return (
    (filters.action === undefined || signal.action === filters.action) &&
    (filters.ticker === undefined || signal.ticker === filters.ticker) &&
    (filters.provider === undefined || signal.provider === filters.provider) &&
    (filters.status === undefined || signal.status === filters.status)
  );
}

/** Encodes a position as an opaque base64url cursor. */
export function encodeSignalCursor({ id, timestamp }: SignalPosition): string {
  return btoa(JSON.stringify({ id, timestamp }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Decodes a cursor produced by `encodeSignalCursor`; null when it is malformed. */
export function decodeSignalCursor(cursor: string): SignalPosition | null {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return null;

  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<SignalPosition>;

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.timestamp !== "string" ||
      Number.isNaN(Date.parse(parsed.timestamp))
    ) {
      return null;
    }
    return { id: parsed.id, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

function generateSignals(): Signal[] {
  return Array.from(
    { length: TOTAL_SIGNALS },
    (_, index) => {
      const ticker = signalTickers[index % signalTickers.length];
      const action = signalActions[index % signalActions.length];
      const details = signalDetails[index % signalDetails.length];
      const confidence = 60 + ((index * 7) % 40);
      const createdAt = new Date(Date.now() - index * 7 * 60 * 1000);
      const timestamp = createdAt.toISOString();
      // Signals expire SIGNAL_TTL_MS after creation
      const expiresAt = new Date(
        createdAt.getTime() + SIGNAL_TTL_MS
      ).toISOString();

      return {
        id: `signal-${index + 1}`,
        ticker,
        action,
        confidence,
        details,
        timestamp,
        expiresAt,
        provider: signalProviders[index % signalProviders.length],
        status: signalStatuses[index % signalStatuses.length],
        // The feed does not carry a price source yet, so quotes stay unavailable
        quote: buildQuote(null, null, null),
      };
    }
  ).sort(compareSignalPositions);
}

export function buildSignalPage(
  page = 1,
  pageSize = 10,
  filters: SignalFeedFilters = {}
): SignalFeedPage {
  const matching = generateSignals().filter((signal) =>
    matchesFilters(signal, filters)
  );

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = matching.slice(start, end);
  const hasMore = end < matching.length;

  return {
    items,
    page,
    pageSize,
    total: matching.length,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
  };
}

/**
 * Returns the signals strictly after `after` in feed order. Pass `null` for the first page.
 * Filters narrow the feed before the boundary is applied.
 */
export function buildSignalCursorPage(
  after: SignalPosition | null,
  pageSize = 10,
  filters: SignalFeedFilters = {}
): SignalCursorPage {
  const matching = generateSignals().filter((signal) =>
    matchesFilters(signal, filters)
  );
  const remaining = after
    ? matching.filter((signal) => compareSignalPositions(signal, after) > 0)
    : matching;

  const items = remaining.slice(0, pageSize);
  const hasMore = remaining.length > pageSize;

  return {
    items,
    pageSize,
    total: matching.length,
    nextCursor: hasMore ? encodeSignalCursor(items[items.length - 1]) : null,
    hasMore,
  };
}

// ── Activity summary (view=activity) ────────────────────────────────────────

export interface ProviderActivitySummary {
  provider: string;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  avgConfidence: number;
  /** ISO timestamp of the provider's most recent signal, null when none. */
  lastSignalAt: string | null;
  /** Deduplicated Stellar assets the provider has covered; absent when unknown. */
  coveredAssets?: string[];
}

export interface ActivitySummaryPage {
  items: ProviderActivitySummary[];
  page: number;
  pageSize: number;
  total: number;
  nextPage: number | null;
  hasMore: boolean;
}

/**
 * Aggregates the feed into a per-provider activity summary, newest provider
 * first, with traditional page/pageSize pagination.
 */
export function buildActivitySummary(
  page = 1,
  pageSize = 10
): ActivitySummaryPage {
  const byProvider = new Map<string, Signal[]>();
  for (const signal of generateSignals()) {
    const key = signal.provider ?? "unknown";
    const bucket = byProvider.get(key);
    if (bucket) bucket.push(signal);
    else byProvider.set(key, [signal]);
  }

  const summaries: ProviderActivitySummary[] = [...byProvider.entries()]
    .map(([provider, signals]) => {
      const confidenceSum = signals.reduce((sum, s) => sum + s.confidence, 0);
      return {
        provider,
        totalSignals: signals.length,
        buySignals: signals.filter((s) => s.action === "BUY").length,
        sellSignals: signals.filter((s) => s.action === "SELL").length,
        holdSignals: signals.filter((s) => s.action === "HOLD").length,
        avgConfidence: Math.round(confidenceSum / signals.length),
        // generateSignals() returns newest-first, so index 0 is the latest.
        lastSignalAt: signals[0]?.timestamp ?? null,
      };
    })
    .sort((a, b) =>
      compareSignalPositions(
        { id: a.provider, timestamp: b.lastSignalAt ?? "" },
        { id: b.provider, timestamp: a.lastSignalAt ?? "" }
      )
    );

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = summaries.slice(start, end);
  const hasMore = end < summaries.length;

  return {
    items,
    page,
    pageSize,
    total: summaries.length,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
  };
}

// ── Confidence history (view=confidence-history) ────────────────────────────

export interface ConfidenceHistoryPoint {
  timestamp: string;
  confidence: number;
}

export interface ConfidenceHistory {
  signalId: string;
  ticker: string;
  points: ConfidenceHistoryPoint[];
}

/**
 * Synthetic confidence history for a single signal. The feed only carries the
 * current confidence, so we derive a deterministic ramp that ends at the
 * signal's current value. Returns null when the signal does not exist.
 */
export function buildConfidenceHistory(signalId: string): ConfidenceHistory | null {
  const signal = generateSignals().find((s) => s.id === signalId);
  if (!signal) return null;

  const pointCount = 5;
  const points: ConfidenceHistoryPoint[] = [];
  const createdMs = Date.parse(signal.timestamp);
  const spanMs = Date.now() - createdMs;

  for (let i = 0; i < pointCount; i++) {
    const fraction = i / (pointCount - 1);
    // Ramp from two-thirds of the final confidence up to the final value.
    const confidence = Math.round(signal.confidence * (2 / 3 + fraction / 3));
    points.push({
      timestamp: new Date(createdMs + spanMs * fraction).toISOString(),
      confidence: Math.min(100, confidence),
    });
  }

  return { signalId: signal.id, ticker: signal.ticker, points };
}
