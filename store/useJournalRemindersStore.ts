import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JournalReminder } from "@/lib/journalReminders";

interface JournalRemindersState {
  reminders: Record<string, JournalReminder>;
  /** Sets or replaces the reminder for an entry (editing clears the delivered flag). */
  setReminder: (entryId: string, remindAt: number, now?: number) => void;
  removeReminder: (entryId: string) => void;
  markFired: (entryId: string, now?: number) => void;
  /** Drops reminders for entries that no longer exist. */
  prune: (existingIds: readonly string[]) => void;
}

export const useJournalRemindersStore = create<JournalRemindersState>()(
  persist(
    (set) => ({
      reminders: {},
      setReminder: (entryId, remindAt, now = Date.now()) =>
        set((state) => ({ reminders: { ...state.reminders, [entryId]: { entryId, remindAt, createdAt: now } } })),
      removeReminder: (entryId) =>
        set((state) => {
          const { [entryId]: _removed, ...rest } = state.reminders;
          return { reminders: rest };
        }),
      markFired: (entryId, now = Date.now()) =>
        set((state) =>
          state.reminders[entryId]
            ? { reminders: { ...state.reminders, [entryId]: { ...state.reminders[entryId], firedAt: now } } }
            : state
        ),
      prune: (existingIds) =>
        set((state) => {
          const keep = Object.fromEntries(Object.entries(state.reminders).filter(([id]) => existingIds.includes(id)));
          return Object.keys(keep).length === Object.keys(state.reminders).length ? state : { reminders: keep };
        }),
    }),
    { name: "journal-reminders" }
  )
);
