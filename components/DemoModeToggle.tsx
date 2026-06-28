"use client";

import { Play } from "lucide-react";
import { useDemoModeStore, useDemoModeHydrated } from "@/store/useDemoModeStore";
import { cn } from "@/lib/utils";

export function DemoModeToggle({ className }: { className?: string }) {
  const { isDemoMode, toggleDemoMode } = useDemoModeStore();
  const isHydrated = useDemoModeHydrated();

  // Render a stable placeholder until localStorage has been read.
  if (!isHydrated) {
    return (
      <div
        className={cn(
          "h-7 w-24 rounded-full bg-foreground/5 animate-pulse",
          className
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      onClick={toggleDemoMode}
      aria-pressed={isDemoMode}
      aria-label={isDemoMode ? "Exit demo mode" : "Enter demo mode"}
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring forced-color-adjust-none",
        isDemoMode
          ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:ring-[Highlight]"
          : "bg-foreground/5 text-foreground-muted hover:bg-foreground/10 hover:text-foreground forced-colors:border forced-colors:border-[ButtonText] forced-colors:text-[ButtonText]",
        className
      )}
    >
      <Play size={12} aria-hidden="true" />
      <span>Demo Mode</span>
      {isDemoMode && (
        <span className="ml-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          ON
        </span>
      )}
    </button>
  );
}
