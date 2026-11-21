import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Pinned signals store (#1097).
 *
 * A pinned signal stays at the top of the feed so the user can keep important
 * signals easy to find without bookmarking, snoozing, dismissing or changing
 * the global sort order. The pin state is orthogonal to all of those.
 *
 * Pinned ids are persisted in insertion order (oldest pin first) so the feed's
 * "pinned first" section is stable and predictable. Pinning a signal that is
 * later expired/dropped from the feed simply no-ops — it reappears at the top
 * the next time it is in the feed, so a pin is never silently lost.
 */

interface PinnedSignalsState {
  /** Pinned signal ids in the order they were pinned (oldest first). */
  pinnedIds: string[];
  /** Pin a signal. No-op if already pinned. */
  pinSignal: (id: string) => void;
  /** Unpin a signal. No-op if not pinned. */
  unpinSignal: (id: string) => void;
  /** Toggle a signal's pin state. */
  togglePin: (id: string) => void;
  /** True when the signal is currently pinned. */
  isPinned: (id: string) => boolean;
  /** Drop every pin. */
  clearPins: () => void;
}

export const usePinnedSignalsStore = create<PinnedSignalsState>()(
  persist(
    (set, get) => ({
      pinnedIds: [],

      pinSignal: (id) =>
        set((state) =>
          state.pinnedIds.includes(id)
            ? state
            : { pinnedIds: [...state.pinnedIds, id] }
        ),

      unpinSignal: (id) =>
        set((state) => ({
          pinnedIds: state.pinnedIds.filter((pid) => pid !== id),
        })),

      togglePin: (id) =>
        set((state) => ({
          pinnedIds: state.pinnedIds.includes(id)
            ? state.pinnedIds.filter((pid) => pid !== id)
            : [...state.pinnedIds, id],
        })),

      isPinned: (id) => get().pinnedIds.includes(id),

      clearPins: () => set({ pinnedIds: [] }),
    }),
    { name: "pinned-signals" }
  )
);
