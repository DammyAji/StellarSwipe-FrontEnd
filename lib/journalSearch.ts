import type { TransactionHistoryItem } from "@/store/useTransactionStore";

/**
 * Full-text search over journal entries (#1062).
 *
 * Matching is case-insensitive and every whitespace-separated term must match
 * (AND semantics), so adding terms narrows the result set. Only the user's own
 * notes and the metadata visible in the journal list are searched.
 */

export interface JournalSearchSegment {
  text: string;
  match: boolean;
}

/** Splits a raw query into trimmed, de-duplicated, lowercased terms. */
export function parseJournalSearchQuery(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  return Array.from(new Set(terms));
}

/** The visible metadata of an entry, in the order it is rendered. */
export function journalSearchableFields(
  entry: Pick<
    TransactionHistoryItem,
    "assetPair" | "type" | "status" | "outcome" | "token" | "notes" | "tags"
  >
): string[] {
  return [
    entry.assetPair,
    entry.type.replace("_", " "),
    entry.status,
    entry.outcome,
    entry.token,
    entry.notes ?? "",
    ...(entry.tags ?? []),
  ].filter((field) => field.length > 0);
}

/** True when every query term appears in the entry's notes or visible metadata. */
export function matchesJournalSearch(
  entry: Parameters<typeof journalSearchableFields>[0],
  terms: readonly string[]
): boolean {
  if (terms.length === 0) return true;
  const haystack = journalSearchableFields(entry).join("\n").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * Splits `text` into plain and matched segments for safe highlighting.
 * Matching is case-insensitive; the original text is always preserved so the
 * result can be rendered as React text nodes (never as HTML).
 */
export function highlightJournalText(
  text: string,
  terms: readonly string[]
): JournalSearchSegment[] {
  const needles = terms.filter(Boolean).map((term) => term.toLowerCase());
  if (!text || needles.length === 0) return [{ text, match: false }];

  const lower = text.toLowerCase();
  const segments: JournalSearchSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let bestIndex = -1;
    let bestLength = 0;
    for (const needle of needles) {
      const index = lower.indexOf(needle, cursor);
      if (index === -1) continue;
      if (bestIndex === -1 || index < bestIndex || (index === bestIndex && needle.length > bestLength)) {
        bestIndex = index;
        bestLength = needle.length;
      }
    }
    if (bestIndex === -1) break;
    if (bestIndex > cursor) {
      segments.push({ text: text.slice(cursor, bestIndex), match: false });
    }
    segments.push({ text: text.slice(bestIndex, bestIndex + bestLength), match: true });
    cursor = bestIndex + bestLength;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }
  return segments.length > 0 ? segments : [{ text, match: false }];
}
