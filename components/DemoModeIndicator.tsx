"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { useDemoModeStore, useDemoModeHydrated } from "@/store/useDemoModeStore";
import { cn } from "@/lib/utils";

/**
 * #1030 — Consistent demo-mode indicator.
 *
 * Rendered once in the root layout so every route that can show demo data
 * carries the same badge. It subscribes to the demo-mode store, so toggling
 * demo mode (e.g. via `DemoModeToggle`) updates it instantly without a reload.
 */
export function DemoModeIndicator({ className }: { className?: string }) {
  const isDemoMode = useDemoModeStore((s) => s.isDemoMode);
  const isHydrated = useDemoModeHydrated();

  // Nothing to announce until localStorage has been read, and nothing to
  // announce in live mode.
  if (!isHydrated || !isDemoMode) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Demo mode active — showing simulated data"
      className={cn(
        "sticky top-0 z-40 flex w-full items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 forced-color-adjust-none forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
        className
      )}
    >
      <FlaskConical size={12} aria-hidden="true" />
      <span>Demo mode — simulated data</span>
      <Link
        href="/demo"
        className="underline underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
      >
        What does this mean?
      </Link>
    </div>
  );
}
