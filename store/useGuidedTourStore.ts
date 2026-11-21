"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const GUIDED_TOUR_STEP_IDS = [
  "wallet",
  "signals",
  "compare",
  "feed-review",
  "feed-details",
  "feed-decide",
] as const;
export type GuidedTourStepId = (typeof GUIDED_TOUR_STEP_IDS)[number];

interface GuidedTourState {
  /** Whether the spotlight overlay is currently visible. */
  active: boolean;
  stepIndex: number;
  completed: boolean;
  dismissed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  /** Restarts the tour from step one, clearing completed/dismissed flags. */
  replay: () => void;
}

/**
 * Tracks the contextual, element-anchored "spotlight" tour separately from
 * the introductory modal in `useOnboardingStore`. Kept as its own persisted
 * store so replaying one doesn't reset the other, and so the spotlight tour
 * can be resumed independently if the user navigates away mid-step.
 */
export const useGuidedTourStore = create<GuidedTourState>()(
  persist(
    (set, get) => ({
      active: false,
      stepIndex: 0,
      completed: false,
      dismissed: false,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      start: () => set({ active: true, dismissed: false }),
      next: () => {
        const { stepIndex } = get();
        if (stepIndex >= GUIDED_TOUR_STEP_IDS.length - 1) {
          set({ active: false, completed: true, stepIndex: 0 });
        } else {
          set({ stepIndex: stepIndex + 1 });
        }
      },
      prev: () => set({ stepIndex: Math.max(0, get().stepIndex - 1) }),
      skip: () => set({ active: false, dismissed: true }),
      replay: () =>
        set({ active: true, stepIndex: 0, completed: false, dismissed: false }),
    }),
    {
      name: "stellar-guided-tour",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export const useGuidedTourHydrated = () =>
  useGuidedTourStore((s) => s._hasHydrated);
