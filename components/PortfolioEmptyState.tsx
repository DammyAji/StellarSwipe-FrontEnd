"use client";

import Link from "next/link";
import { BarChart2, PieChart, Wallet, ArrowRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortfolioEmptyVariant =
  | "allocation"  // shown inside the donut chart card
  | "pnl"         // shown inside the P&L widget card
  | "summary"     // shown inside the summary-cards strip
  | "full";       // full-page / standalone view

interface PortfolioEmptyStateProps {
  variant?: PortfolioEmptyVariant;
  /** Override the heading. */
  heading?: string;
  /** Override the body copy. */
  body?: string;
  /** Override the CTA label. */
  ctaLabel?: string;
  /** Override the CTA href. */
  ctaHref?: string;
  /** When provided, the CTA renders as a button that runs this handler. */
  onCtaClick?: () => void;
  className?: string;
}

const VARIANT_DEFAULTS: Record<
  PortfolioEmptyVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    heading: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  }
> = {
  allocation: {
    icon: PieChart,
    heading: "No portfolio data available",
    body: "Your allocation chart will appear once you make your first trade.",
    ctaLabel: "Explore signals",
    ctaHref: "/app",
  },
  pnl: {
    icon: TrendingUp,
    heading: "No P&L data yet",
    body: "Execute a trade to start tracking your realized and unrealized gains.",
    ctaLabel: "Browse signals",
    ctaHref: "/app",
  },
  summary: {
    icon: BarChart2,
    heading: "Portfolio is empty",
    body: "Connect your wallet and make your first trade to see a live snapshot here.",
    ctaLabel: "Get started",
    ctaHref: "/app",
  },
  full: {
    icon: Wallet,
    heading: "Your portfolio is empty",
    body: "You haven't made any trades yet. Swipe through signals to find your first opportunity.",
    ctaLabel: "View signals",
    ctaHref: "/app",
  },
};

/**
 * PortfolioEmptyState
 *
 * Drop-in replacement for blank/missing portfolio states. Provides:
 * - Contextual icon, heading, and body copy per variant
 * - A clear next-step CTA that navigates to the relevant action
 * - Visually balanced layout on both mobile and desktop
 * - Fully accessible (landmark role, descriptive link text)
 */
export function PortfolioEmptyState({
  variant = "full",
  heading,
  body,
  ctaLabel,
  ctaHref,
  onCtaClick,
  className,
}: PortfolioEmptyStateProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const Icon = defaults.icon;

  const resolvedHeading = heading ?? defaults.heading;
  const resolvedBody = body ?? defaults.body;
  const resolvedCtaLabel = ctaLabel ?? defaults.ctaLabel;
  const resolvedCtaHref = ctaHref ?? defaults.ctaHref;

  const isCompact = variant === "allocation" || variant === "pnl" || variant === "summary";

  return (
    <div
      role="region"
      aria-label={resolvedHeading}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact ? "gap-3 py-6 px-4" : "gap-5 py-12 px-6",
        className
      )}
    >
      {/* Icon badge */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          isCompact ? "h-10 w-10 bg-sky-500/10" : "h-14 w-14 bg-sky-500/10"
        )}
        aria-hidden="true"
      >
        <Icon
          className={cn(
            "text-sky-400",
            isCompact ? "h-5 w-5" : "h-7 w-7"
          )}
        />
      </div>

      {/* Copy */}
      <div className={cn("space-y-1", isCompact ? "max-w-[220px]" : "max-w-xs")}>
        <p
          className={cn(
            "font-semibold text-foreground",
            isCompact ? "text-sm" : "text-base"
          )}
        >
          {resolvedHeading}
        </p>
        <p
          className={cn(
            "leading-relaxed text-muted-foreground",
            isCompact ? "text-xs" : "text-sm"
          )}
        >
          {resolvedBody}
        </p>
      </div>

      {/* CTA */}
      {onCtaClick ? (
        <button
          type="button"
          onClick={onCtaClick}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
            isCompact
              ? "bg-sky-600 px-3 py-1.5 text-xs text-white"
              : "bg-sky-600 px-4 py-2 text-sm text-white"
          )}
        >
          {resolvedCtaLabel}
          <ArrowRight
            className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")}
            aria-hidden="true"
          />
        </button>
      ) : (
        <Link
          href={resolvedCtaHref}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
            isCompact
              ? "bg-sky-600 px-3 py-1.5 text-xs text-white"
              : "bg-sky-600 px-4 py-2 text-sm text-white"
          )}
          aria-label={`${resolvedCtaLabel} — start building your portfolio`}
        >
          {resolvedCtaLabel}
          <ArrowRight
            className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")}
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
