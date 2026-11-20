import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appendRevision, type JournalRevision } from "@/lib/journalRevisions";
import { useTransactionStore, type TransactionHistoryItem } from "@/store/useTransactionStore";

interface JournalRevisionState {
  /** Saved versions per entry id, oldest first. */
  revisions: Record<string, JournalRevision[]>;
  /** Records new versions for entries that changed; entries with a sync in flight are skipped. */
  observe: (history: readonly TransactionHistoryItem[], pendingIds: readonly string[], now?: number) => void;
}

export const useJournalRevisionStore = create<JournalRevisionState>()(
  persist(
    (set, get) => ({
      revisions: {},
      observe: (history, pendingIds, now = Date.now()) => {
        const current = get().revisions;
        const next: Record<string, JournalRevision[]> = {};
        let changed = false;
        for (const entry of history) {
          // Skip optimistic copies that are still syncing: only saved versions count.
          const list = pendingIds.includes(entry.id) ? current[entry.id] : appendRevision(current[entry.id], entry, now);
          if (list) next[entry.id] = list;
          if (list !== current[entry.id]) changed = true;
        }
        if (Object.keys(current).length !== Object.keys(next).length) changed = true;
        if (changed) set({ revisions: next });
      },
    }),
    { name: "journal-revisions" }
  )
);

/** Starts recording versions whenever the journal changes. Returns an unsubscribe function. */
export function trackJournalRevisions(): () => void {
  const run = () => {
    const { history, pendingIds } = useTransactionStore.getState();
    useJournalRevisionStore.getState().observe(history, pendingIds);
  };
  run();
  return useTransactionStore.subscribe(run);
}
