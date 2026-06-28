import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DemoState {
  isDemoMode: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean) => void;
}

export const useDemoModeStore = create<DemoState>()(
  persist(
    (set) => ({
      isDemoMode: false,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
      setDemoMode: (enabled) => set({ isDemoMode: enabled }),
    }),
    {
      name: "demo-mode-store",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Returns `true` once localStorage has been read and state is stable. */
export const useDemoModeHydrated = () => useDemoModeStore((s) => s._hasHydrated);
