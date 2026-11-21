import type { Signal } from "./signals";

/**
 * Index of the first signal in `signals` that arrived after `lastVisitAt`.
 *
 * Returns `null` when the divider must be omitted: no recorded visit, an
 * unparseable boundary, or no signal newer than the boundary. Signals are
 * expected newest-first, so the boundary is the first match.
 */
export function findNewSinceDividerIndex(
  signals: Pick<Signal, "timestamp">[],
  lastVisitAt: string | null | undefined
): number | null {
  if (!lastVisitAt) return null;

  const boundary = Date.parse(lastVisitAt);
  if (Number.isNaN(boundary)) return null;

  for (let index = 0; index < signals.length; index += 1) {
    const timestamp = Date.parse(signals[index]!.timestamp);
    // Unparseable timestamps are never presented as "new".
    if (Number.isNaN(timestamp)) continue;
    if (timestamp > boundary) return index;
  }

  return null;
}
