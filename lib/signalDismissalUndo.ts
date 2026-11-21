/**
 * signalDismissalUndo.ts
 *
 * Pure helpers for the temporary "Undo" action shown after a signal is
 * dismissed from the feed (#1032).
 *
 * A dismissal is recorded as a token that captures the signal's prior feed
 * position. The token expires after `UNDO_WINDOW_MS`; once it has expired — or
 * once the user has made a later decision about the same signal — the undo can
 * no longer be applied, so a stale toast can never reverse a newer decision.
 */

/** How long the undo action stays available after a dismissal. */
export const UNDO_WINDOW_MS = 8000;

export interface DismissalUndoToken {
  signalId: string;
  /** Index the signal occupied in the feed before it was dismissed. */
  index: number;
  /** Epoch ms after which the undo is no longer valid. */
  expiresAt: number;
  /** Monotonic sequence number of the dismissal that created this token. */
  sequence: number;
}

export type UndoOutcome =
  | { status: "restored"; signalId: string; index: number }
  | { status: "expired"; signalId: string }
  | { status: "superseded"; signalId: string };

/**
 * Creates an undo token for a dismissal. `sequence` must increase with every
 * decision the user makes about a signal so later decisions supersede earlier
 * undo tokens.
 */
export function createDismissalUndoToken(
  signalId: string,
  index: number,
  sequence: number,
  now: number = Date.now(),
  windowMs: number = UNDO_WINDOW_MS
): DismissalUndoToken {
  return {
    signalId,
    index: Math.max(0, Math.trunc(index)),
    expiresAt: now + Math.max(0, windowMs),
    sequence,
  };
}

/** True while the undo token is still within its visible expiry window. */
export function isUndoTokenActive(
  token: DismissalUndoToken,
  now: number = Date.now()
): boolean {
  return token.expiresAt > now;
}

/** Milliseconds left before the undo action expires (never negative). */
export function undoRemainingMs(
  token: DismissalUndoToken,
  now: number = Date.now()
): number {
  return Math.max(0, token.expiresAt - now);
}

/**
 * Resolves what applying an undo token should do.
 *
 * - `expired`    — the visible window has passed.
 * - `superseded` — a later decision (higher sequence) exists for the signal,
 *                  so the undo must not reverse it.
 * - `restored`   — the signal may be re-inserted at its prior index.
 */
export function resolveUndo(
  token: DismissalUndoToken,
  latestSequence: number,
  now: number = Date.now()
): UndoOutcome {
  if (latestSequence > token.sequence) {
    return { status: "superseded", signalId: token.signalId };
  }

  if (!isUndoTokenActive(token, now)) {
    return { status: "expired", signalId: token.signalId };
  }

  return { status: "restored", signalId: token.signalId, index: token.index };
}

/**
 * Re-inserts a restored signal at its prior feed position. Returns a new array;
 * the input is never mutated. Out-of-range indexes clamp to the end.
 */
export function restoreSignalAt<T extends { id: string }>(
  signals: readonly T[],
  signal: T,
  index: number
): T[] {
  const withoutSignal = signals.filter((item) => item.id !== signal.id);
  const target = Math.min(Math.max(0, Math.trunc(index)), withoutSignal.length);

  return [
    ...withoutSignal.slice(0, target),
    signal,
    ...withoutSignal.slice(target),
  ];
}

/** Accessible announcement text for the undo action. */
export function buildUndoAnnouncement(
  label: string,
  seconds: number
): string {
  return `${label} dismissed. Undo available for ${seconds} seconds.`;
}
