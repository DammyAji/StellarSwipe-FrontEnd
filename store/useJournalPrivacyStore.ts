import { create } from "zustand";

interface JournalPrivacyState {
  /** True while financial values on the journal page are masked. Not persisted. */
  masked: boolean;
  toggle: () => void;
  setMasked: (masked: boolean) => void;
}

/**
 * Private-value display mode for the journal. It lives only in memory so a reload
 * (or another page) always starts with values visible; nothing is written to the
 * journal data.
 */
export const useJournalPrivacyStore = create<JournalPrivacyState>()((set) => ({
  masked: false,
  toggle: () => set((state) => ({ masked: !state.masked })),
  setMasked: (masked) => set({ masked }),
}));
