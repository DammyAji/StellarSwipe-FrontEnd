import { normalizeJournalTags } from "@/lib/journalSchema";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

export interface TagCount {
  tag: string;
  count: number;
}

/** Tags used by entries, with how many entries use each, most used first. */
export function countTags(history: readonly Pick<TransactionHistoryItem, "tags">[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const item of history) {
    for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  );
}

export interface PickerTag extends TagCount {
  pinned: boolean;
  selected: boolean;
}

export interface PickerGroups {
  pinned: PickerTag[];
  others: PickerTag[];
}

/**
 * Orders tags for the editor's picker: pinned tags first, in the order they were
 * pinned, then the remaining known tags by usage. A pinned tag that no entry uses
 * any more (for example after every entry using it was deleted) stays available
 * with a count of 0 so the pin is never lost or broken.
 */
export function orderTagsForPicker(
  known: readonly TagCount[],
  pinned: readonly string[],
  selected: readonly string[]
): PickerGroups {
  const pinnedTags = normalizeJournalTags(pinned);
  const selectedSet = new Set(normalizeJournalTags(selected));
  const counts = new Map(known.map((k) => [k.tag, k.count]));
  const pinnedSet = new Set(pinnedTags);
  return {
    pinned: pinnedTags.map((tag) => ({ tag, count: counts.get(tag) ?? 0, pinned: true, selected: selectedSet.has(tag) })),
    others: known
      .filter((k) => !pinnedSet.has(k.tag))
      .map((k) => ({ ...k, pinned: false, selected: selectedSet.has(k.tag) })),
  };
}

/** Pins a tag that is not pinned, or unpins one that is. Input is normalized first. */
export function togglePinnedTag(pinned: readonly string[], tag: string): string[] {
  const [normalized] = normalizeJournalTags([tag]);
  if (!normalized) return [...pinned];
  return pinned.includes(normalized) ? pinned.filter((t) => t !== normalized) : [...pinned, normalized];
}
