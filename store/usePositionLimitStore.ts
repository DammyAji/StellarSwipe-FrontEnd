import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PositionLimitState {
  enabled: boolean;
  percentage: number; // e.g., 5 = 5%
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setPercentage: (percentage: number) => void;
  toggle: () => void;
}

export const usePositionLimitStore = create<PositionLimitState>()(
  persist(
    (set) => ({
      enabled: false,
      percentage: 5,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setEnabled: (enabled) => set({ enabled }),
      setPercentage: (percentage) => set({ percentage }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: "position-limit-store",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Returns `true` once localStorage has been read and state is stable. */
export const usePositionLimitHydrated = () => usePositionLimitStore((s) => s._hasHydrated);
