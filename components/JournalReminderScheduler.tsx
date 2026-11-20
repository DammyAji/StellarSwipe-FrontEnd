"use client";

import { useJournalReminderScheduler } from "@/hooks/useJournalReminderScheduler";

/** Renders nothing; delivers due journal reminders while the journal page is open. */
export function JournalReminderScheduler() {
  useJournalReminderScheduler();
  return null;
}
