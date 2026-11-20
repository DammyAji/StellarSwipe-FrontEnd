"use client";

import { useEffect } from "react";
import { dueReminders, notificationSupport } from "@/lib/journalReminders";
import { toast } from "@/lib/toast";
import { useJournalRemindersStore } from "@/store/useJournalRemindersStore";
import { useTransactionStore, type TransactionHistoryItem } from "@/store/useTransactionStore";

const CHECK_INTERVAL_MS = 15_000;

function deliver(entry: TransactionHistoryItem) {
  const title = `Revisit your ${entry.assetPair} journal entry`;
  const body = "This is the follow-up reminder you set.";
  // The in-app toast always shows; a system notification is added only when allowed.
  toast.info(title, { description: body, duration: 10_000 });
  if (notificationSupport() === "granted") {
    try {
      new Notification(title, { body, tag: `journal-reminder-${entry.id}` });
    } catch {
      // The in-app toast above already delivered the reminder.
    }
  }
}

/**
 * Delivers due reminders while the app is open: checks on an interval and when
 * the tab becomes visible again. Reminders for deleted entries are dropped.
 */
export function useJournalReminderScheduler() {
  useEffect(() => {
    const check = () => {
      const { history } = useTransactionStore.getState();
      const store = useJournalRemindersStore.getState();
      store.prune(history.map((entry) => entry.id));
      for (const reminder of dueReminders(useJournalRemindersStore.getState().reminders, Date.now())) {
        const entry = history.find((item) => item.id === reminder.entryId);
        if (!entry) continue;
        store.markFired(reminder.entryId);
        deliver(entry);
      }
    };
    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
