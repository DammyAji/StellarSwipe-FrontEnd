"use client";

import { motion } from "framer-motion";
import { BookOpen, RadioTower, RefreshCw, SearchX, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type EmptyStateVariant = "no-signals" | "no-results" | "no-followed" | "no-scope-results";

type SignalScope = "active" | "archived" | "all";

interface SignalEmptyStateProps {
  /** Controls which copy and icon are shown.
   *  - "no-signals"        — initial load / no signals published yet (default)
   *  - "no-results"        — active filters returned zero matches
   *  - "no-followed"       — followed-providers filter is on but nothing is followed
   *  - "no-scope-results"  — the selected active/archived/all scope has no signals
   */
  variant?: EmptyStateVariant;
  /**
   * The active/archived/all scope the user is viewing. Used by the
   * "no-scope-results" variant to name the scope explicitly in the copy.
   */
  scope?: SignalScope;
  onRefresh: () => void;
  /**
   * Called when the user clicks "Clear filters" in the no-results variant,
   * "Show all signals" in the no-followed variant, or "Show all signals" in
   * the no-scope-results variant.
   * If omitted the button still appears but only calls `onRefresh`.
   */
  onClearFilters?: () => void;
}

const SCOPE_COPY: Record<
  SignalScope,
  { heading: string; body: string; ariaLabel: string }
> = {
  active: {
    heading: "No active signals for this provider",
    body: "This provider has no active signals right now. Switch to archived or all signals to see more.",
    ariaLabel: "No active signals for this provider",
  },
  archived: {
    heading: "No archived signals for this provider",
    body: "This provider has no archived signals. Switch to active or all signals to see more.",
    ariaLabel: "No archived signals for this provider",
  },
  all: {
    heading: "No signals for this provider",
    body: "This provider hasn't published any signals yet. Try refreshing or check back later.",
    ariaLabel: "No signals for this provider",
  },
};

const VARIANTS: Record<
  EmptyStateVariant,
  {
    Icon: React.ElementType;
    heading: string;
    body: string;
    ariaLabel: string;
  }
> = {
  "no-signals": {
    Icon: RadioTower,
    heading: "No signals available right now",
    body: "New signals appear as providers publish them. Follow providers to get notified first.",
    ariaLabel: "No signals available",
  },
  "no-results": {
    Icon: SearchX,
    heading: "No signals match your filters",
    body: "Try adjusting or clearing your filters to see more signals.",
    ariaLabel: "No signals match the current filters",
  },
  "no-followed": {
    Icon: Users,
    heading: "You aren't following any providers yet",
    body: "Follow a provider to see only their signals here, or switch back to all signals.",
    ariaLabel: "No followed providers",
  },
};

export function SignalEmptyState({
  variant = "no-signals",
  scope = "all",
  onRefresh,
  onClearFilters,
}: SignalEmptyStateProps) {
  const { Icon, heading, body, ariaLabel } =
    variant === "no-scope-results"
      ? { Icon: SearchX, ...SCOPE_COPY[scope] }
      : VARIANTS[variant];

  const handleClearFilters = () => {
    onClearFilters?.();
    onRefresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <EmptyState
        ariaLabel={ariaLabel}
        title={heading}
        description={body}
        className="py-16"
        icon={<Icon className="h-8 w-8 text-sky-400/70" />}
        action={
          variant === "no-results" ? (
            <Button
              size="sm"
              variant="default"
              onClick={handleClearFilters}
              className="gap-2 bg-sky-500 hover:bg-sky-400 text-white"
              aria-label="Clear all filters and refresh"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </Button>
          ) : variant === "no-scope-results" ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => onClearFilters?.()}
              className="gap-2 bg-sky-500 hover:bg-sky-400 text-white"
              aria-label="Show signals from all scopes"
            >
              <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
              Show all signals
            </Button>
          ) : variant === "no-followed" ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => onClearFilters?.()}
              className="gap-2 bg-sky-500 hover:bg-sky-400 text-white"
              aria-label="Show signals from all providers"
            >
              <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
              Show all signals
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
          )
        }
        secondaryAction={
          variant === "no-followed" ? (
            <Button size="sm" variant="outline" asChild className="gap-2">
              <Link href="/providers">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Find Providers
              </Link>
            </Button>
          ) : variant === "no-signals" ? (
            <>
              <Button size="sm" asChild className="gap-2">
                <Link href="/providers">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Follow Providers
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild className="gap-2">
                <a
                  href="https://docs.stellarswipe.io"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Browse Docs
                </a>
              </Button>
            </>
          ) : (
            /* no-results / no-scope-results secondary action: soft refresh without clearing filters */
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
          )
        }
      />
    </motion.div>
  );
}
