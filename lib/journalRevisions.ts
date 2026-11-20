import type { TransactionHistoryItem } from "@/store/useTransactionStore";

/** Fields whose changes count as a new saved version of an entry. */
export const TRACKED_FIELDS = [
  "assetPair",
  "type",
  "amount",
  "price",
  "fee",
  "token",
  "status",
  "outcome",
  "tags",
  "notes",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

export const FIELD_LABELS: Record<TrackedField, string> = {
  assetPair: "Asset pair",
  type: "Type",
  amount: "Amount",
  price: "Price",
  fee: "Fee",
  token: "Token",
  status: "Status",
  outcome: "Outcome",
  tags: "Tags",
  notes: "Notes",
};

export const MAX_REVISIONS_PER_ENTRY = 50;

export type RevisionFields = Record<TrackedField, string>;

export interface JournalRevision {
  /** 1-based position in this entry's history. */
  version: number;
  capturedAt: number;
  /** "baseline" is the first state this device saw, not necessarily the original. */
  source: "baseline" | "edit";
  fields: RevisionFields;
}

export interface FieldChange {
  field: TrackedField;
  label: string;
  before: string;
  after: string;
}

function valueOf(entry: TransactionHistoryItem, field: TrackedField): string {
  const raw = (entry as unknown as Record<string, unknown>)[field];
  if (Array.isArray(raw)) return raw.join(", ");
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

export function snapshotEntry(entry: TransactionHistoryItem): RevisionFields {
  const fields = {} as RevisionFields;
  for (const field of TRACKED_FIELDS) fields[field] = valueOf(entry, field);
  return fields;
}

export function sameFields(a: RevisionFields, b: RevisionFields): boolean {
  return TRACKED_FIELDS.every((field) => a[field] === b[field]);
}

/**
 * Adds a version for `entry` when its tracked fields differ from the latest saved
 * version (or creates the baseline). Returns the same array when nothing changed.
 */
export function appendRevision(
  existing: readonly JournalRevision[] | undefined,
  entry: TransactionHistoryItem,
  now: number
): JournalRevision[] {
  const list = existing ?? [];
  const fields = snapshotEntry(entry);
  const latest = list[list.length - 1];
  if (latest && sameFields(latest.fields, fields)) return list as JournalRevision[];
  const next: JournalRevision = {
    version: (latest?.version ?? 0) + 1,
    capturedAt: now,
    source: latest ? "edit" : "baseline",
    fields,
  };
  return [...list, next].slice(-MAX_REVISIONS_PER_ENTRY);
}

/** Fields that differ between two versions, in display order. */
export function diffRevisions(before: JournalRevision, after: JournalRevision): FieldChange[] {
  return TRACKED_FIELDS.filter((field) => before.fields[field] !== after.fields[field]).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    before: before.fields[field],
    after: after.fields[field],
  }));
}

/** A comparison needs at least two saved versions. */
export function hasComparableHistory(revisions: readonly JournalRevision[] | undefined): boolean {
  return (revisions?.length ?? 0) >= 2;
}
