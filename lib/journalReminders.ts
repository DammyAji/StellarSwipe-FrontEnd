export interface JournalReminder {
  entryId: string;
  /** When to remind, as epoch milliseconds. */
  remindAt: number;
  createdAt: number;
  /** Set once the reminder has been delivered, so it is not shown twice. */
  firedAt?: number;
}

/** Minimum lead time so a reminder cannot be set for "now". */
export const MIN_LEAD_MS = 60_000;

export function validateReminderTime(remindAt: number, now: number): string | null {
  if (!Number.isFinite(remindAt)) return "Enter a valid date and time.";
  if (remindAt < now + MIN_LEAD_MS) return "Choose a time at least a minute in the future.";
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Value for an `<input type="datetime-local">` in the user's local time zone. */
export function toLocalInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses a datetime-local value as local time; NaN when invalid. */
export function fromLocalInputValue(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return Number.NaN;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  // Reject overflow such as 2025-02-31, which Date would silently roll over.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return Number.NaN;
  return date.getTime();
}

/** Localized display of a reminder time, including the time zone. */
export function formatReminderTime(timestamp: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

export interface ReminderPreset {
  label: string;
  at: number;
}

export function reminderPresets(now: number): ReminderPreset[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", at: now + 60 * 60 * 1000 },
    { label: "Tomorrow, 9:00", at: tomorrow.getTime() },
    { label: "In 1 week", at: now + 7 * 24 * 60 * 60 * 1000 },
  ];
}

/** Reminders that are due and have not been delivered yet, earliest first. */
export function dueReminders(reminders: Record<string, JournalReminder>, now: number): JournalReminder[] {
  return Object.values(reminders)
    .filter((r) => r.firedAt === undefined && r.remindAt <= now)
    .sort((a, b) => a.remindAt - b.remindAt);
}

export type NotificationSupport = "unsupported" | "default" | "granted" | "denied";

export function notificationSupport(): NotificationSupport {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotificationSupport;
}

/** The next step to offer when browser notifications cannot deliver the reminder. */
export function notificationAdvice(support: NotificationSupport): string | null {
  switch (support) {
    case "granted":
      return null;
    case "default":
      return "Enable browser notifications to be reminded even when this tab is in the background. Without them you get an in-app reminder while the app is open.";
    case "denied":
      return "Browser notifications are blocked for this site. Allow them in your browser's site settings, or rely on the in-app reminder while the app is open.";
    default:
      return "This browser does not support notifications. You will get an in-app reminder while the app is open.";
  }
}

/** Whether reminders can be stored in this browser (localStorage available and writable). */
export function canPersistReminders(): boolean {
  try {
    const key = "__journal_reminder_probe__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
