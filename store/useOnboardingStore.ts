import { create } from "zustand";
import { persist } from "zustand/middleware";

export const ONBOARDING_TOTAL_STEPS = 3;

interface OnboardingState {
  completed: boolean;
  dismissed: boolean;
  currentStep: number;
  checklistDismissed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setCompleted: () => void;
  setDismissed: () => void;
  setCurrentStep: (step: number) => void;
  setChecklistDismissed: (dismissed: boolean) => void;
  reset: () => void;
  /**
   * Restarts the walkthrough from the first step. Unlike `reset`, this keeps
   * the persisted `completed` flag so a finished walkthrough is not recorded
   * as incomplete again, and it never touches account preferences.
   */
  restart: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      dismissed: false,
      currentStep: 0,
      checklistDismissed: false,
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setCompleted: () =>
        set({
          completed: true,
          dismissed: true,
          currentStep: ONBOARDING_TOTAL_STEPS,
        }),
      setDismissed: () => set({ dismissed: true }),
      setCurrentStep: (step: number) => set({ currentStep: step }),
      setChecklistDismissed: (dismissed) =>
        set({ checklistDismissed: dismissed }),
      reset: () => set({ completed: false, dismissed: false, currentStep: 0 }),
      restart: () => set({ dismissed: false, currentStep: 0 }),
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
export const useOnboardingHydrated = () =>
  useOnboardingStore((s) => s._hasHydrated);
