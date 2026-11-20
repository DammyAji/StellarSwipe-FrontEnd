"use client";

import { Bell } from "lucide-react";
import { formatReminderTime } from "@/lib/journalReminders";
import { useJournalRemindersStore } from "@/store/useJournalRemindersStore";

interface JournalReminderChipProps {
  entryId: string;
  assetPair: string;
  onOpen: (entryId: string) => void;
}

/** Row button that shows whether a reminder is set and opens the reminder dialog. */
export function JournalReminderChip({ entryId, assetPair, onOpen }: JournalReminderChipProps) {
  const reminder = useJournalRemindersStore((state) => state.reminders[entryId]);
  const label = reminder
    ? reminder.firedAt !== undefined
      ? "Reminder sent"
      : `Reminder ${formatReminderTime(reminder.remindAt)}`
    : "Remind me";
  return (
    <button
      type="button"
      onClick={() => onOpen(entryId)}
      aria-label={reminder ? `Edit reminder for ${assetPair} entry` : `Set a reminder for ${assetPair} entry`}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground transition hover:border-white/20 hover:bg-white/10"
    >
      <Bell size={12} aria-hidden="true" />
      {label}
    </button>
  );
}
