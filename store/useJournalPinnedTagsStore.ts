import { create } from "zustand";
import { persist } from "zustand/middleware";
import { togglePinnedTag } from "@/lib/journalPinnedTags";

interface JournalPinnedTagsState {
  /** Normalized tags in the order they were pinned. */
  pinned: string[];
  toggle: (tag: string) => void;
}

/** Pinned tags only affect the picker's ordering; entries are never modified. */
export const useJournalPinnedTagsStore = create<JournalPinnedTagsState>()(
  persist(
    (set) => ({
      pinned: [],
      toggle: (tag) => set((state) => ({ pinned: togglePinnedTag(state.pinned, tag) })),
    }),
    { name: "journal-pinned-tags" }
  )
);
