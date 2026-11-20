"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canPersistReminders,
  formatReminderTime,
  fromLocalInputValue,
  notificationAdvice,
  notificationSupport,
  reminderPresets,
  toLocalInputValue,
  validateReminderTime,
  type NotificationSupport,
} from "@/lib/journalReminders";
import { toast } from "@/lib/toast";
import { useJournalRemindersStore } from "@/store/useJournalRemindersStore";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

interface JournalReminderDialogProps {
  entry: TransactionHistoryItem | null;
  onClose: () => void;
}

/** Set, edit or remove a follow-up reminder for a journal entry. */
export function JournalReminderDialog({ entry, onClose }: JournalReminderDialogProps) {
  const existing = useJournalRemindersStore((state) => (entry ? state.reminders[entry.id] : undefined));
  const setReminder = useJournalRemindersStore((state) => state.setReminder);
  const removeReminder = useJournalRemindersStore((state) => state.removeReminder);

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<NotificationSupport>("unsupported");
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);

  useEffect(() => {
    if (!entry) return;
    setValue(toLocalInputValue(existing?.remindAt ?? Date.now() + 60 * 60 * 1000));
    setError(null);
    setPermissionMessage(null);
    setSupport(notificationSupport());
    setCanPersist(canPersistReminders());
    // Only reset when a different entry opens; edits to the same entry keep the typed value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  function handleSave() {
    if (!entry) return;
    const remindAt = fromLocalInputValue(value);
    const problem = validateReminderTime(remindAt, Date.now());
    if (problem) {
      setError(problem);
      return;
    }
    setReminder(entry.id, remindAt);
    toast.success(existing ? "Reminder updated" : "Reminder set", {
      description: `We'll remind you ${formatReminderTime(remindAt)}.`,
    });
    onClose();
  }

  function handleRemove() {
    if (!entry) return;
    removeReminder(entry.id);
    toast.success("Reminder removed");
    onClose();
  }

  async function handleEnableNotifications() {
    try {
      const result = await Notification.requestPermission();
      setSupport(result as NotificationSupport);
      setPermissionMessage(
        result === "granted"
          ? "Browser notifications are on."
          : "Permission was not granted. You will still get an in-app reminder while the app is open."
      );
    } catch {
      setPermissionMessage("The browser could not ask for permission. You will still get an in-app reminder while the app is open.");
    }
  }

  const advice = notificationAdvice(support);
  const presets = reminderPresets(Date.now());

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit follow-up reminder" : "Set a follow-up reminder"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {entry ? `Revisit your ${entry.assetPair} entry.` : ""}
            {existing ? ` Currently set for ${formatReminderTime(existing.remindAt)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="journal-reminder-time" className="text-xs font-medium text-slate-400">
              Remind me at (your local time)
            </label>
            <input
              id="journal-reminder-time"
              type="datetime-local"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "journal-reminder-error" : undefined}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p id="journal-reminder-error" role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick times">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setValue(toLocalInputValue(preset.at));
                  setError(null);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {advice && (
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300" role="status">
              <BellOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-2">
                <p>{advice}</p>
                {support === "default" && (
                  <Button type="button" size="sm" variant="outline" onClick={handleEnableNotifications}>
                    <Bell size={12} aria-hidden="true" /> Enable browser notifications
                  </Button>
                )}
              </div>
            </div>
          )}
          {permissionMessage && (
            <p className="text-xs text-slate-300" role="status">
              {permissionMessage}
            </p>
          )}
          {!canPersist && (
            <p className="text-xs text-amber-300" role="alert">
              This browser is blocking local storage, so the reminder will be lost if you reload. Allow site storage and set
              it again to keep it.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existing && (
            <Button type="button" variant="ghost" onClick={handleRemove}>
              Remove reminder
            </Button>
          )}
          <Button type="button" onClick={handleSave}>
            {existing ? "Update reminder" : "Set reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
