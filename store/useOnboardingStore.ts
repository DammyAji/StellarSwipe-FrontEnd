import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  completed: boolean;
  dismissed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setCompleted: () => void;
  setDismissed: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      dismissed: false,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setCompleted: () => set({ completed: true, dismissed: true }),
      setDismissed: () => set({ dismissed: true }),
      reset: () => set({ completed: false, dismissed: false }),
    }),
    {
      name: "stellar-onboarding",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Returns `true` once localStorage has been read and state is stable. */
export const useOnboardingHydrated = () => useOnboardingStore((s) => s._hasHydrated);
