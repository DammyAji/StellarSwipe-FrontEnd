import { create } from "zustand";
import type { JournalDraftFromTransaction } from "@/lib/journalFromTransaction";

interface JournalDraftState {
  /** Draft waiting for the journal editor to pick it up. Not persisted. */
  pending: JournalDraftFromTransaction | null;
  request: (draft: JournalDraftFromTransaction) => void;
  /** Called by the editor once it has taken over the draft. */
  consume: () => void;
}

export const useJournalDraftStore = create<JournalDraftState>()((set) => ({
  pending: null,
  request: (draft) => set({ pending: draft }),
  consume: () => set({ pending: null }),
}));
