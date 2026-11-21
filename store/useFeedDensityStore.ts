import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FeedDensity = "comfortable" | "compact";

/** #1033: card vs list presentation for the signal feed. */
export type FeedLayout = "card" | "list";

interface FeedDensityState {
  density: FeedDensity;
  setDensity: (d: FeedDensity) => void;
  layout: FeedLayout;
  setLayout: (layout: FeedLayout) => void;
}

export const useFeedDensityStore = create<FeedDensityState>()(
  persist(
    (set) => ({
      density: "comfortable",
      setDensity: (density) => set({ density }),
      layout: "card",
      setLayout: (layout) => set({ layout }),
    }),
    { name: "signal-feed-density" }
  )
);
