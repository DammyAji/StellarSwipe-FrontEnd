/**
 * Provider track-record length filtering (#1088).
 *
 * A provider's track-record length is the number of days between its first
 * recorded signal and now. Providers with no recorded history have an unknown
 * length and are therefore never treated as qualifying.
 */

/** Minimal shape needed to derive a provider's track-record length. */
export interface TrackRecordSource {
  providerId?: string;
  /** ISO timestamp of the provider's first recorded signal */
  firstSignalAt?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the track-record length in whole days, or `null` when the history is
 * missing or unparseable. Never guesses a value.
 */
export function getTrackRecordDays(
  firstSignalAt: string | undefined | null,
  now: number = Date.now()
): number | null {
  if (!firstSignalAt) return null;
  const startedAt = Date.parse(firstSignalAt);
  if (Number.isNaN(startedAt)) return null;
  const days = Math.floor((now - startedAt) / MS_PER_DAY);
  return days < 0 ? null : days;
}

/**
 * Whether a provider qualifies for a minimum track-record length.
 * A cleared threshold (`null`/`undefined`) qualifies everything; a set
 * threshold excludes providers whose history is missing.
 */
export function qualifiesTrackRecord(
  days: number | null,
  minDays: number | null | undefined
): boolean {
  if (minDays === null || minDays === undefined) return true;
  if (days === null) return false;
  return days >= minDays;
}

/** Normalises a user-entered threshold; empty/invalid input clears it. */
export function parseMinTrackRecordDays(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/** Human-readable label for the active threshold, shown in the controls. */
export function formatTrackRecordThreshold(minDays: number | null): string {
  if (minDays === null) return "Any track record";
  return `Track record ≥ ${minDays} day${minDays === 1 ? "" : "s"}`;
}
