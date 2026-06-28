"use client";

import { useState } from "react";
import { useOnboardingStore, useOnboardingHydrated } from "@/store/useOnboardingStore";
import { Button } from "@/components/ui/button";
import { ChevronRight, Wallet, LayoutList, ArrowLeftRight, X } from "lucide-react";

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
  const { dismissed, setCompleted, setDismissed } = useOnboardingStore();
  const isHydrated = useOnboardingHydrated();
  const [step, setStep] = useState(0);

  // Don't render until we know the persisted dismissed/completed state.
  // This prevents flashing the onboarding dialog on returning users.
  if (!isHydrated || dismissed) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      setCompleted();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to StellarSwipe"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/50">
        {/* Skip button */}
        <button
          type="button"
          onClick={setDismissed}
          aria-label="Skip onboarding"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <X size={16} aria-hidden="true" />
        </button>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-sky-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
          <Icon size={28} aria-hidden="true" />
        </div>

        {/* Content */}
        <h2 className="mb-2 text-lg font-semibold text-white">{current.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-400">{current.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={setDismissed}
            className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
          >
            Skip
          </button>
          <Button
            onClick={handleNext}
            size="sm"
            className="flex items-center gap-1.5"
            aria-label={isLast ? "Finish onboarding" : `Next: ${STEPS[step + 1]?.title}`}
          >
            {isLast ? "Get started" : "Next"}
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
