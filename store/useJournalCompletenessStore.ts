import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_REQUIREMENTS, type CompletenessRequirements } from "@/lib/journalIncomplete";

interface JournalCompletenessState {
  requirements: CompletenessRequirements;
  setRequirements: (requirements: CompletenessRequirements) => void;
}

/** Which details the journal expects each entry to have; used by the "incomplete" filter only. */
export const useJournalCompletenessStore = create<JournalCompletenessState>()(
  persist(
    (set) => ({
      requirements: DEFAULT_REQUIREMENTS,
      setRequirements: (requirements) => set({ requirements }),
    }),
    { name: "journal-completeness-requirements" }
  )
);
