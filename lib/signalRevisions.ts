/**
 * Signal revision history (#953)
 *
 * When a provider edits an active signal, the previous content is kept rather
 * than overwritten. Each revision stores the full content after the edit, the
 * fields that changed, and who made the change and when.
 *
 * Revisions are append-only and frozen. The current state is the latest
 * revision, so it stays queryable without losing earlier content.
 *
 * Authorization is not checked here: callers must confirm the actor may edit
 * the signal (see `canMutateProviderSignal`) before appending a revision.
 */

import type { Signal, SignalAction } from "./signals";

export const SIGNAL_REVISION_FIELDS = [
  "ticker",
  "action",
  "confidence",
  "details",
  "expiresAt",
] as const;

export type SignalRevisionField = (typeof SIGNAL_REVISION_FIELDS)[number];

/** Human-readable labels for revision fields, used by the UI. */
export const SIGNAL_REVISION_FIELD_LABELS: Record<SignalRevisionField, string> = {
  ticker: "Pair",
  action: "Action",
  confidence: "Confidence",
  details: "Details",
  expiresAt: "Expiry",
};

/** Provider-editable content of a signal. */
export interface SignalRevisionContent {
  readonly ticker: string;
  readonly action: SignalAction;
  readonly confidence: number;
  readonly details: string;
  /** ISO timestamp. `null` when the signal has no expiry. */
  readonly expiresAt: string | null;
}

export interface SignalRevision {
  readonly signalId: string;
  /** 1-based and contiguous per signal. */
  readonly revision: number;
  /** Full content as it stood after this revision. */
  readonly content: SignalRevisionContent;
  /** Fields that differ from the previous revision. Empty for the first one. */
  readonly changedFields: readonly SignalRevisionField[];
  /** Provider or admin who made the change. */
  readonly actorId: string;
  /** ISO timestamp. */
  readonly changedAt: string;
}

/** All revisions for one signal, oldest first. */
export type SignalRevisionLog = readonly SignalRevision[];

export function toSignalRevisionContent(
  signal: Pick<
    Signal,
    "ticker" | "action" | "confidence" | "details" | "expiresAt"
  >
): SignalRevisionContent {
  return {
    ticker: signal.ticker,
    action: signal.action,
    confidence: signal.confidence,
    details: signal.details,
    expiresAt: signal.expiresAt ?? null,
  };
}

/** Fields whose values differ between two contents, in declaration order. */
export function diffSignalRevisionContent(
  previous: SignalRevisionContent,
  next: SignalRevisionContent
): SignalRevisionField[] {
  return SIGNAL_REVISION_FIELDS.filter(
    (field) => previous[field] !== next[field]
  );
}

function buildRevision(
  signalId: string,
  revision: number,
  content: SignalRevisionContent,
  changedFields: readonly SignalRevisionField[],
  actorId: string,
  now: Date
): SignalRevision {
  if (!actorId.trim()) {
    throw new Error(`Revision ${revision} of ${signalId} must record an actor`);
  }
  return Object.freeze({
    signalId,
    revision,
    content: Object.freeze({ ...content }),
    changedFields: Object.freeze([...changedFields]),
    actorId,
    changedAt: now.toISOString(),
  });
}

/** Starts a log with revision 1, the signal's content as first recorded. */
export function createSignalRevisionLog(
  signalId: string,
  content: SignalRevisionContent,
  actorId: string,
  now: Date = new Date()
): SignalRevisionLog {
  return Object.freeze([
    buildRevision(signalId, 1, content, [], actorId, now),
  ]);
}

/** The latest revision, which is the signal's current state. */
export function getCurrentSignalRevision(
  log: SignalRevisionLog
): SignalRevision {
  const latest = log[log.length - 1];
  if (!latest) {
    throw new Error("Signal has no revisions");
  }
  return latest;
}

/** A specific revision by number, or `undefined` if it doesn't exist. */
export function getSignalRevision(
  log: SignalRevisionLog,
  revision: number
): SignalRevision | undefined {
  return log.find((entry) => entry.revision === revision);
}

/**
 * Returns a new log with the edit appended as the next revision. The input
 * log is never mutated. If nothing changed, the input log is returned as is.
 */
export function appendSignalRevision(
  log: SignalRevisionLog,
  content: SignalRevisionContent,
  actorId: string,
  now: Date = new Date()
): SignalRevisionLog {
  const latest = getCurrentSignalRevision(log);
  const changedFields = diffSignalRevisionContent(latest.content, content);
  if (changedFields.length === 0) return log;

  return Object.freeze([
    ...log,
    buildRevision(
      latest.signalId,
      latest.revision + 1,
      content,
      changedFields,
      actorId,
      now
    ),
  ]);
}
