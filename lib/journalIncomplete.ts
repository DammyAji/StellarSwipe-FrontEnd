import type { TransactionHistoryItem } from "@/store/useTransactionStore";

export type MissingField = "tags" | "outcome";

export interface CompletenessRequirements {
  /** Entries must carry at least one tag. */
  requireTags: boolean;
  /** Completed entries (succeeded or failed) must have a win/loss outcome. */
  requireOutcome: boolean;
}

export const DEFAULT_REQUIREMENTS: CompletenessRequirements = {
  requireTags: true,
  requireOutcome: true,
};

export const MISSING_LABELS: Record<MissingField, string> = {
  tags: "tags",
  outcome: "outcome",
};

/** True when at least one requirement is configured; otherwise nothing can be flagged. */
export function hasRequirements(requirements: CompletenessRequirements): boolean {
  return requirements.requireTags || requirements.requireOutcome;
}

/**
 * The required details an entry is missing. A requirement that does not apply to
 * an entry never flags it: pending entries have no outcome to record yet, and
 * with no requirements configured nothing is flagged.
 */
export function missingFieldsFor(
  entry: Pick<TransactionHistoryItem, "tags" | "status" | "outcome">,
  requirements: CompletenessRequirements
): MissingField[] {
  const missing: MissingField[] = [];
  if (requirements.requireTags && (entry.tags ?? []).length === 0) missing.push("tags");
  const completed = entry.status === "SUCCEEDED" || entry.status === "FAILED";
  if (requirements.requireOutcome && completed && entry.outcome === "PENDING") missing.push("outcome");
  return missing;
}

/** Entry id -> missing fields, only for entries that are missing something. */
export function incompleteEntryMap(
  history: readonly Pick<TransactionHistoryItem, "id" | "tags" | "status" | "outcome">[],
  requirements: CompletenessRequirements
): Map<string, MissingField[]> {
  const map = new Map<string, MissingField[]>();
  if (!hasRequirements(requirements)) return map;
  for (const entry of history) {
    const missing = missingFieldsFor(entry, requirements);
    if (missing.length > 0) map.set(entry.id, missing);
  }
  return map;
}

export function describeMissing(fields: readonly MissingField[]): string {
  return `Missing ${fields.map((f) => MISSING_LABELS[f]).join(" and ")}`;
}

/** Text announced for the current state of the incomplete filter. */
export function incompleteStatusMessage(requirements: CompletenessRequirements, count: number): string {
  if (!hasRequirements(requirements)) return "No requirements are configured, so no entries are flagged.";
  if (count === 0) return "No entries are missing required details.";
  return `${count} ${count === 1 ? "entry is" : "entries are"} missing required details.`;
}
