"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Wallet,
  LayoutList,
  GitCompare,
  X,
  ListChecks,
  PanelRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore, useOnboardingHydrated } from "@/store/useOnboardingStore";
import {
  GUIDED_TOUR_STEP_IDS,
  useGuidedTourHydrated,
  useGuidedTourStore,
  type GuidedTourStepId,
} from "@/store/useGuidedTourStore";

const STEP_COPY: Record<
  GuidedTourStepId,
  { icon: React.ElementType; title: string; description: string }
> = {
  wallet: {
    icon: Wallet,
    title: "Connect your wallet",
    description:
      "This is where you link Freighter. Trades execute on-chain from here once connected.",
  },
  signals: {
    icon: LayoutList,
    title: "Browse live signals",
    description:
      "Every trade idea from providers you follow shows up here first. Swipe or click to act on one.",
  },
  compare: {
    icon: GitCompare,
    title: "Compare signals",
    description:
      "Add signals to a side-by-side comparison before deciding which one to act on.",
  },
  "feed-review": {
    icon: ListChecks,
    title: "Review a signal",
    description:
      "Each card shows the ticker, direction, confidence and provider. Tap or click a card to review it — nothing is traded from here.",
  },
  "feed-details": {
    icon: PanelRight,
    title: "Inspect the details",
    description:
      "The detail pane shows the full rationale, status and related active signals so you can check the setup before acting.",
  },
  "feed-decide": {
    icon: ShieldCheck,
    title: "Make a deliberate decision",
    description:
      "Take your time: bookmark, compare or dismiss. This walkthrough never places a trade — you stay in control.",
  },
};

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(id: GuidedTourStepId): TargetRect | null {
  const el = document.querySelector(`[data-tour="${id}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/**
 * Lightweight, element-anchored onboarding tour. Highlights real UI (wallet
 * connect, signal feed, compare) with a dimmed spotlight + contextual
 * tooltip, rather than a single generic modal. Skippable and resumable via
 * `useGuidedTourStore`; falls back to a bottom sheet on narrow viewports
 * since anchoring a floating tooltip next to small-screen nav items is
 * unreliable.
 */
export function GuidedTourSpotlight() {
  const { active, stepIndex, next, prev, skip } = useGuidedTourStore();
  const tourHydrated = useGuidedTourHydrated();
  const { dismissed: introDismissed } = useOnboardingStore();
  const introHydrated = useOnboardingHydrated();
  const start = useGuidedTourStore((s) => s.start);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  const stepId = GUIDED_TOUR_STEP_IDS[stepIndex];

  const recalc = useCallback(() => {
    if (!stepId) return;
    setRect(measure(stepId));
  }, [stepId]);

  // Feed steps anchor to the first signal card, which only exists once the
  // feed has rendered — retry briefly until the target is measurable.
  useEffect(() => {
    if (!active || !stepId || !stepId.startsWith("feed-")) return;
    if (measure(stepId)) return;
    const interval = setInterval(() => {
      const next = measure(stepId);
      if (next) {
        setRect(next);
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [active, stepId]);

  // Auto-start the spotlight tour once the intro modal has been handled —
  // this is the "first meaningful action" trigger for returning users who
  // already dismissed the intro on a previous visit.
  useEffect(() => {
    if (!introHydrated || !tourHydrated) return;
    const { completed, dismissed, active: alreadyActive } =
      useGuidedTourStore.getState();
    if (introDismissed && !completed && !dismissed && !alreadyActive) {
      const timer = setTimeout(() => start(), 800);
      return () => clearTimeout(timer);
    }
  }, [introDismissed, introHydrated, tourHydrated, start]);

  useEffect(() => {
    const checkWidth = () => setIsNarrow(window.innerWidth < 640);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (!active) return;
    recalc();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [active, recalc]);

  if (!active || !stepId) return null;

  const { icon: Icon, title, description } = STEP_COPY[stepId];
  const isLast = stepIndex === GUIDED_TOUR_STEP_IDS.length - 1;

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-accent-sky" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <button
          type="button"
          onClick={skip}
          aria-label="Skip guided tour"
          className="rounded-md p-1 text-foreground-muted hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-foreground-muted">{description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-foreground-muted">
          Step {stepIndex + 1} of {GUIDED_TOUR_STEP_IDS.length}
        </span>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <Button size="sm" variant="ghost" onClick={prev}>
              Back
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={next}>
            {isLast ? "Done" : "Next"}
            {!isLast && <ArrowRight size={13} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </>
  );

  if (isNarrow || !rect) {
    return (
      <div
        role="dialog"
        aria-label={`Guided tour: ${title}`}
        className="fixed inset-x-3 bottom-3 z-[60] rounded-2xl border border-border bg-surface-high/95 p-4 shadow-elevation-3 backdrop-blur"
      >
        {cardBody}
      </div>
    );
  }

  const tooltipTop = rect.top + rect.height + 12;
  const tooltipLeft = Math.min(Math.max(rect.left, 12), window.innerWidth - 332);
  const tooltipHeight = 200;
  const fitsBelow = tooltipTop + tooltipHeight <= window.innerHeight;
  const tooltipStyle = fitsBelow
    ? { top: tooltipTop, left: tooltipLeft }
    : { top: Math.max(12, rect.top - tooltipHeight - 12), left: tooltipLeft };

  return (
    <>
      {/* Spotlight: a transparent cutout at the target rect, dimming everything
          else via an oversized box-shadow — avoids needing an SVG mask. */}
      <div
        aria-hidden="true"
        className="fixed z-[59] rounded-lg transition-all duration-200"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
        }}
      />
      <div
        role="dialog"
        aria-label={`Guided tour: ${title}`}
        className="fixed z-[60] w-[min(90vw,320px)] rounded-2xl border border-border bg-surface-high/95 p-4 shadow-elevation-3 backdrop-blur transition-all duration-200"
        style={tooltipStyle}
      >
        {cardBody}
      </div>
    </>
  );
}
