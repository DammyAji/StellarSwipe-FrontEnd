"use client";

import { useCallback } from "react";
import { toast } from "@/lib/toast";
import { t, formatDate } from "@/lib/i18n";
import {
  useSnoozeStore,
  DEFAULT_SNOOZE_DURATION_MS,
} from "@/store/useSnoozeStore";

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return t("snooze.minutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  return t("snooze.hours", { count: hours });
}

/**
 * Snooze actions for a signal — temporarily hide it from the feed without
 * dismissing or bookmarking it (#321). Shows an undo toast so an accidental
 * snooze can be reverted immediately.
 */
export function useSnoozeActions() {
  const snoozeSignal = useSnoozeStore((state) => state.snoozeSignal);
  const unsnoozeSignal = useSnoozeStore((state) => state.unsnoozeSignal);
  const isSnoozed = useSnoozeStore((state) => state.isSnoozed);

  const snooze = useCallback(
    (
      id: string,
      label: string,
      durationMs: number = DEFAULT_SNOOZE_DURATION_MS,
      until?: Date | number
    ) => {
      let effectiveDurationMs = durationMs;
      let returnTime: Date | null = null;

      if (until !== undefined) {
        const untilMs = until instanceof Date ? until.getTime() : until;
        if (typeof untilMs !== "number" || !Number.isFinite(untilMs)) {
          throw new Error("Invalid snooze return time: expected a valid date.");
        }
        const now = Date.now();
        if (untilMs <= now) {
          throw new Error("Invalid snooze return time: must be in the future.");
        }
        effectiveDurationMs = untilMs - now;
        returnTime = new Date(untilMs);
      }

      snoozeSignal(id, effectiveDurationMs);
      const description = returnTime
        ? `${label} will return on ${formatDate(returnTime)}.`
        : `${label} is hidden for ${formatDuration(effectiveDurationMs)}.`;
      toast.info("Signal snoozed", {
        description,
        duration: 4500,
        action: {
          label: "Undo",
          onClick: () => unsnoozeSignal(id),
        },
      });
    },
    [snoozeSignal, unsnoozeSignal]
  );

  const unsnooze = useCallback(
    (id: string) => unsnoozeSignal(id),
    [unsnoozeSignal]
  );

  return { snooze, unsnooze, isSnoozed };
}
