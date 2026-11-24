import type { ProviderSignal } from "@/lib/types";

/**
 * Provider performance aggregates computed from closed signals.
 *
 * Calculation rules:
 * - Eligible signals are closed: outcome is WIN or LOSS.
 * - Incomplete outcomes (PENDING or any other value) are excluded from every
 *   rate and count of eligible signals. They are reported separately in
 *   `excludedIncomplete` so the UI can show how much history is still open.
 * - Win rate is wins / sampleCount * 100, or 0 when there are no eligible
 *   signals.
 * - The optional `from` / `to` ISO bounds are inclusive and are compared
 *   against each signal's timestamp. Signals with an unparseable timestamp
 *   fall outside any window and are skipped.
 * - `window` reports the earliest and latest timestamps of the eligible
 *   signals actually aggregated, or nulls when there are none.
 * - Samples smaller than MIN_SAMPLE_SIZE set `isLowSample`. The rate is still
 *   returned, but it should be presented as indicative only.
 */

export const MIN_SAMPLE_SIZE = 10;

export interface ProviderPerformanceOptions {
  from?: string;
  to?: string;
}

export interface ProviderPerformance {
  sampleCount: number;
  wins: number;
  losses: number;
  winRate: number;
  excludedIncomplete: number;
  isLowSample: boolean;
  window: { from: string | null; to: string | null };
}

/**
 * Returns the deduplicated, sorted list of Stellar asset codes covered by a
 * provider's signals.
 *
 * Rules:
 * - Asset codes are trimmed and upper-cased so casing/whitespace variants of
 *   the same asset collapse into one entry.
 * - Missing, empty or whitespace-only asset values are ignored.
 * - No assets are fabricated: an empty input yields an empty array.
 */
export function getCoveredAssets(signals: { asset?: string }[]): string[] {
  const assets = new Set<string>();

  for (const signal of signals) {
    const asset = signal.asset?.trim().toUpperCase();
    if (asset) assets.add(asset);
  }

  return [...assets].sort();
}

export function computeProviderPerformance(
  signals: ProviderSignal[],
  { from, to }: ProviderPerformanceOptions = {},
): ProviderPerformance {
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = to ? Date.parse(to) : Infinity;

  let excludedIncomplete = 0;
  const closed: { timestamp: string; time: number; outcome: string }[] = [];

  for (const signal of signals) {
    const time = Date.parse(signal.timestamp);
    if (!(time >= fromMs && time <= toMs)) continue;

    if (signal.outcome !== "WIN" && signal.outcome !== "LOSS") {
      excludedIncomplete++;
      continue;
    }

    closed.push({
      timestamp: signal.timestamp,
      time,
      outcome: signal.outcome,
    });
  }

  const wins = closed.filter((s) => s.outcome === "WIN").length;
  const losses = closed.length - wins;
  const sampleCount = closed.length;

  const sorted = [...closed].sort((a, b) => a.time - b.time);
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];

  return {
    sampleCount,
    wins,
    losses,
    winRate: sampleCount === 0 ? 0 : (wins / sampleCount) * 100,
    excludedIncomplete,
    isLowSample: sampleCount < MIN_SAMPLE_SIZE,
    window: {
      from: earliest?.timestamp ?? null,
      to: latest?.timestamp ?? null,
    },
  };
}
