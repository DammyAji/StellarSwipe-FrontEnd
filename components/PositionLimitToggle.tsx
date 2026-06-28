"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, Shield, SlidersHorizontal } from "lucide-react";
import { usePositionLimitStore, usePositionLimitHydrated } from "@/store/usePositionLimitStore";

interface PositionLimitToggleProps {
  /** Total portfolio balance in XLM (or base asset) */
  portfolioBalance?: number | null;
  /** Whether portfolio data is still loading */
  isLoading?: boolean;
}

export function PositionLimitToggle({
  portfolioBalance,
  isLoading = false,
}: PositionLimitToggleProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { enabled, percentage, toggle, setPercentage } = usePositionLimitStore();
  const isHydrated = usePositionLimitHydrated();

  const portfolioAvailable = portfolioBalance !== null && portfolioBalance !== undefined && !isLoading;

  const calculatedLimit = useMemo(() => {
    if (!portfolioAvailable || !enabled) return null;
    return ((portfolioBalance! * percentage) / 100).toFixed(2);
  }, [portfolioBalance, percentage, enabled, portfolioAvailable]);

  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(100, Math.max(1, Number(e.target.value)));
    setPercentage(val);
  };

  // Render a stable skeleton until the persisted store state is available.
  if (!isHydrated) {
    return (
      <div className="w-full rounded-xl border border-border bg-surface/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-32 rounded bg-surface-high animate-pulse" />
          <div className="h-6 w-11 rounded-full bg-surface-high animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-surface/60 p-4 transition-colors hover:border-border-strong">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground">Position Limit</span>
          <div className="relative">
            <button
              type="button"
              aria-label="Position limit help"
              className="flex items-center"
              onMouseEnter={() => setTooltipOpen(true)}
              onMouseLeave={() => setTooltipOpen(false)}
              onFocus={() => setTooltipOpen(true)}
              onBlur={() => setTooltipOpen(false)}
            >
              <Info
                className="h-3.5 w-3.5 text-foreground-subtle cursor-help"
                aria-hidden="true"
              />
            </button>
            {tooltipOpen && (
              <div
                id="position-limit-tooltip"
                role="tooltip"
                className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 text-xs shadow-xl shadow-black/40"
              >
                <p className="mb-1 font-semibold text-foreground">
                  Position Limit
                </p>
                <div className="space-y-1 text-foreground-muted">
                  <p>
                    Limits each trade to a percentage of your total portfolio. When
                    enabled, trades exceeding this limit will be automatically
                    reduced.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Max:</span>{" "}
                    25% per trade (slider range)
                  </p>
                </div>
                <div
                  className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        </div>

        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle position limit"
          disabled={!portfolioAvailable}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background fc-toggle ${
            !portfolioAvailable
              ? "cursor-not-allowed opacity-40"
              : enabled
                ? "bg-primary"
                : "bg-foreground/20"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Explanation text when enabled */}
      <motion.div
        initial={false}
        animate={{
          height: enabled && portfolioAvailable ? "auto" : 0,
          opacity: enabled && portfolioAvailable ? 1 : 0,
        }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="mt-3 space-y-3">
          <p className="text-xs text-foreground-subtle">
            Cap trade at <span className="font-medium text-foreground">{percentage}%</span> of portfolio
            {calculatedLimit && (
              <span className="text-foreground-muted">
                {" "}· Max trade: <span className="font-mono text-foreground">{calculatedLimit} XLM</span>
              </span>
            )}
          </p>

          {/* Slider */}
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              value={percentage}
              onChange={handlePercentageChange}
              aria-label="Position limit percentage"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-high accent-[hsl(var(--accent-primary))]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[hsl(var(--accent-primary))]
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-[hsl(var(--accent-primary))] [&::-moz-range-thumb]:border-0"
            />
            <span className="min-w-[3ch] text-right text-xs font-mono text-foreground-muted">
              {percentage}%
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5">
            {[1, 3, 5, 10, 15, 25].map((val) => (
              <button
                key={val}
                onClick={() => setPercentage(val)}
                aria-label={`Set position limit to ${val}%`}
                aria-pressed={percentage === val}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  percentage === val
                    ? "bg-accent-primary/10 text-accent-sky ring-1 ring-[hsl(var(--accent-primary)/0.3)]"
                    : "bg-surface-high text-foreground-subtle hover:bg-border hover:text-foreground-muted"
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Disabled state explanation */}
      {!portfolioAvailable && !isLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs text-accent-warning/70"
        >
          Connect wallet and load portfolio to enable position limits
        </motion.p>
      )}

      {/* Loading state */}
      {isLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs text-foreground-subtle"
        >
          Loading portfolio data...
        </motion.p>
      )}
    </div>
  );
}
