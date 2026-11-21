import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FeedVisitState {
  /** ISO timestamp of the previous feed visit; null on a first visit. */
  lastVisitAt: string | null;
  /** Record the start of a new visit, keeping the previous boundary. */
  startVisit: (now?: Date) => void;
}

export const useFeedVisitStore = create<FeedVisitState>()(
  persist(
    (set) => ({
      lastVisitAt: null,
      startVisit: (now = new Date()) =>
        set((state) => ({
          // Only advance the boundary once per visit; repeated calls in the
          // same session must not move the divider.
          lastVisitAt: state.lastVisitAt ?? now.toISOString(),
        })),
    }),
    { name: "signal-feed-last-visit" }
  )
);
