import {
  dueReminders,
  fromLocalInputValue,
  notificationAdvice,
  reminderPresets,
  toLocalInputValue,
  validateReminderTime,
  MIN_LEAD_MS,
} from "@/lib/journalReminders";

describe("validateReminderTime", () => {
  const now = new Date(2025, 5, 1, 10, 0).getTime();
  it("rejects invalid and too-soon times", () => {
    expect(validateReminderTime(Number.NaN, now)).toMatch(/valid/i);
    expect(validateReminderTime(now + MIN_LEAD_MS - 1, now)).toMatch(/future/i);
    expect(validateReminderTime(now - 5000, now)).toMatch(/future/i);
  });
  it("accepts a time far enough ahead", () => {
    expect(validateReminderTime(now + MIN_LEAD_MS, now)).toBeNull();
  });
});

describe("local datetime input conversion", () => {
  it("round-trips local time", () => {
    const ts = new Date(2025, 11, 31, 23, 45).getTime();
    expect(toLocalInputValue(ts)).toBe("2025-12-31T23:45");
    expect(fromLocalInputValue("2025-12-31T23:45")).toBe(ts);
  });
  it("rejects malformed and impossible values", () => {
    expect(fromLocalInputValue("")).toBeNaN();
    expect(fromLocalInputValue("2025-02-31T10:00")).toBeNaN();
    expect(fromLocalInputValue("not a date")).toBeNaN();
  });
});

describe("dueReminders", () => {
  const reminders = {
    a: { entryId: "a", remindAt: 100, createdAt: 0 },
    b: { entryId: "b", remindAt: 50, createdAt: 0 },
    c: { entryId: "c", remindAt: 10, createdAt: 0, firedAt: 20 },
    d: { entryId: "d", remindAt: 900, createdAt: 0 },
  };
  it("returns undelivered reminders that are due, earliest first", () => {
    expect(dueReminders(reminders, 100).map((r) => r.entryId)).toEqual(["b", "a"]);
  });
});

describe("reminderPresets", () => {
  it("offers future times", () => {
    const now = new Date(2025, 5, 1, 10, 0).getTime();
    const presets = reminderPresets(now);
    expect(presets).toHaveLength(3);
    expect(presets.every((p) => p.at > now)).toBe(true);
    expect(new Date(presets[1].at).getHours()).toBe(9);
  });
});

describe("notificationAdvice", () => {
  it("gives a next step unless notifications are already granted", () => {
    expect(notificationAdvice("granted")).toBeNull();
    expect(notificationAdvice("default")).toMatch(/enable browser notifications/i);
    expect(notificationAdvice("denied")).toMatch(/site settings/i);
    expect(notificationAdvice("unsupported")).toMatch(/does not support/i);
  });
});
