"use client";

import { Clock, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface ExpiredSignalBannerProps {
  /** Called when the user clicks the refresh CTA */
  onRefresh?: () => void;
}

/**
 * Banner shown on signal cards that have expired or are no longer actionable.
 *
 * Design goals:
 * - Clearly visible without overwhelming the card (amber, not red).
 * - Prevents accidental trades by blocking the trade button via the parent.
 * - Includes a refresh CTA so users know how to get fresh data.
 *
 * Accessibility:
 * - role="status" so screen readers announce it without interrupting.
 * - Refresh button has a descriptive aria-label.
 */
export function ExpiredSignalBanner({ onRefresh }: ExpiredSignalBannerProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-label="This signal has expired and is no longer actionable"
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.2 }}
      className="flex items-center justify-between gap-3 rounded-lg border border-accent-warning/40 bg-accent-warning/10 px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Clock
          size={13}
          className="shrink-0 text-accent-warning"
          aria-hidden="true"
        />
        <span className="text-accent-warning font-medium">Signal expired</span>
        <span className="text-foreground-muted hidden sm:inline truncate">
          — this signal is no longer actionable
        </span>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh signals to get the latest data"
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-accent-warning/40 bg-accent-warning/15
            px-2 py-1 text-xs font-medium text-accent-warning transition-all
            hover:bg-accent-warning/25 active:scale-95
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
        >
          <RefreshCw size={11} aria-hidden="true" />
          Refresh
        </button>
      )}
    </motion.div>
  );
}
