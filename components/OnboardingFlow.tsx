"use client";

import { useEffect } from "react";
import {
  useOnboardingStore,
  useOnboardingHydrated,
  ONBOARDING_TOTAL_STEPS,
} from "@/store/useOnboardingStore";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  LayoutList,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: Wallet,
    title: "Connect your wallet",
    description:
      "Link your Freighter wallet to start trading. StellarSwipe uses Stellar's fast, low-fee network to execute trades on your behalf.",
  },
  {
    icon: LayoutList,
    title: "Browse the signal feed",
    description:
      "Scroll through live trade signals from providers. Filter by asset or direction, search by keyword, and sort by confidence or recency.",
  },
  {
    icon: ArrowLeftRight,
    title: "Swipe to trade",
    description:
      "Swipe right (or press →) to execute a trade. Swipe left (or press ←) to pass. Each swipe is confirmed on-chain instantly.",
  },
];

export function OnboardingFlow() {
  const { dismissed, currentStep, setCompleted, setDismissed, setCurrentStep } =
    useOnboardingStore();
  const isHydrated = useOnboardingHydrated();
  const focusTrapRef = useFocusTrap({ isActive: true });

  // Resume incomplete progress after navigation: the persisted step is
  // restored on rehydration, so the flow reopens where the user left off.
  useEffect(() => {
    if (!isHydrated) return;
    const { completed, dismissed: isDismissed, currentStep: step } =
      useOnboardingStore.getState();
    if (!completed && !isDismissed && step > 0) {
      useOnboardingStore.getState().setCurrentStep(step);
    }
  }, [isHydrated]);

  if (!isHydrated || dismissed) return null;

  const step = Math.min(currentStep, STEPS.length - 1);
  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);

  function handleNext() {
    if (isLast) {
      setCompleted();
    } else {
      const next = step + 1;
      setCurrentStep(next);
    }
  }

  function handleBack() {
    if (!isFirst) setCurrentStep(step - 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to StellarSwipe"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        ref={focusTrapRef}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-auto rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-black/50 sm:max-h-none sm:p-6"
      >
        <button
          type="button"
          onClick={setDismissed}
          aria-label="Skip onboarding"
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:right-4 sm:top-4"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <ol aria-label="Onboarding progress" className="mb-4 flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const status =
              i < step ? "completed" : i === step ? "current" : "upcoming";
            return (
              <li
                key={s.title}
                className="flex-1"
                aria-current={i === step ? "step" : undefined}
              >
                <span className="sr-only">
                  Step {i + 1}: {s.title} ({status})
                </span>
                <div
                  aria-hidden="true"
                  className={`h-1 rounded-full transition-all duration-200 ${
                    i <= step ? "bg-sky-500" : "bg-white/10"
                  }`}
                />
              </li>
            );
          })}
        </ol>

        <p className="mb-4 text-xs text-foreground-muted" aria-live="polite">
          Step {step + 1} of {STEPS.length} · {progressPercent}% complete
        </p>

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
          <Icon size={28} aria-hidden="true" />
        </div>

        <h2 className="mb-2 text-lg font-semibold text-white">{current.title}</h2>
        <p className="mb-5 text-sm leading-relaxed text-slate-400 sm:mb-6">
          {current.description}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={setDismissed}
            className="rounded text-xs text-slate-500 underline transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Skip for now
          </button>
          <div className="flex items-center justify-end gap-2">
            {!isFirst && (
              <Button
                onClick={handleBack}
                size="sm"
                variant="ghost"
                className="flex min-h-10 items-center justify-center gap-1.5 px-3"
                aria-label={`Back: ${STEPS[step - 1]?.title}`}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              size="sm"
              className="flex min-h-10 items-center justify-center gap-1.5 px-4"
              aria-label={
                isLast ? "Finish onboarding" : `Next: ${STEPS[step + 1]?.title}`
              }
            >
              {isLast ? "Get started" : "Next"}
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
