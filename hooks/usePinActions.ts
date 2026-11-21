"use client";

import { useCallback } from "react";
import { toast } from "@/lib/toast";
import { usePinnedSignalsStore } from "@/store/usePinnedSignalsStore";

/**
 * Pin actions for a signal (#1097) — keep it at the top of the feed without
 * bookmarking, snoozing, dismissing or changing the global sort order.
 *
 * Each action immediately reflects the user's intent in local state and shows
 * an undo toast so an accidental pin can be reverted instantly, mirroring the
 * `useSnoozeActions` pattern.
 */
export function usePinActions() {
  const pinSignal = usePinnedSignalsStore((state) => state.pinSignal);
  const unpinSignal = usePinnedSignalsStore((state) => state.unpinSignal);
  const togglePin = usePinnedSignalsStore((state) => state.togglePin);
  const isPinned = usePinnedSignalsStore((state) => state.isPinned);

  /**
   * Pins a signal. Shows a confirmation toast with an undo action.
   */
  const pin = useCallback(
    (id: string, label: string) => {
      pinSignal(id);
      toast.success("Pinned to top", {
        description: `${label} stays at the top of your feed.`,
        duration: 3000,
        action: {
          label: "Undo",
          onClick: () => unpinSignal(id),
        },
      });
    },
    [pinSignal, unpinSignal]
  );

  /**
   * Unpins a signal. Shows an undo toast so the pin can be restored.
   */
  const unpin = useCallback(
    (id: string, label: string) => {
      unpinSignal(id);
      toast.info("Unpinned", {
        description: `${label} returns to its normal position in the feed.`,
        duration: 4500,
        action: {
          label: "Undo",
          onClick: () => pinSignal(id),
        },
      });
    },
    [unpinSignal, pinSignal]
  );

  /**
   * Toggles a signal's pin state, choosing the right toast for the new state.
   */
  const toggle = useCallback(
    (id: string, label: string) => {
      if (isPinned(id)) {
        unpin(id, label);
      } else {
        pin(id, label);
      }
    },
    [isPinned, pin, unpin]
  );

  return { pin, unpin, toggle, isPinned, togglePin };
}
