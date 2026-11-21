"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Explicit state for an analytics panel (#1055).
 *
 * Analytics panels must never blur "no data yet", "still loading" and
 * "failed to load" into one blank box, and must never render sample data as
 * if it were real activity. Panels derive this state from their data source
 * and render exactly one of the three branches below.
 */
export type AnalyticsPanelState = "loading" | "error" | "empty" | "ready";

export interface AnalyticsPanelStateInput {
  /** Data request is in flight and nothing has been rendered yet. */
  isLoading?: boolean;
  /** Data request failed. Takes precedence over empty/ready. */
  error?: unknown;
  /** Number of real data points available. */
  itemCount: number;
}

/** Resolve the panel state, keeping loading/error distinct from empty. */
export function resolveAnalyticsPanelState({
  isLoading = false,
  error,
  itemCount,
}: AnalyticsPanelStateInput): AnalyticsPanelState {
  if (error) return "error";
  if (isLoading) return "loading";
  return itemCount > 0 ? "ready" : "empty";
}

export interface AnalyticsEmptyStateProps {
  /** What the panel shows, e.g. "P&L history". */
  title: string;
  /** Which data is required before the panel can render. */
  requiredData: string;
  /** Label of the next step the user should take. */
  actionLabel: string;
  /** Where that next step lives. */
  actionHref: string;
  className?: string;
}

/**
 * Guided empty state: explains the data needed and links to the next step.
 * Contains no sample values, so it can never be mistaken for real activity.
 */
export function AnalyticsEmptyState({
  title,
  requiredData,
  actionLabel,
  actionHref,
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={`${requiredData} Nothing is shown until real data exists — no sample values are displayed.`}
      icon={<Inbox className="h-6 w-6 text-sky-400" />}
      className={className}
      action={
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      }
    />
  );
}

export interface AnalyticsPanelStateViewProps extends AnalyticsEmptyStateProps {
  state: AnalyticsPanelState;
  /** Retry handler for the error branch. */
  onRetry?: () => void;
  /** Loading label for the loading branch. */
  loadingLabel?: string;
  /** Rendered when `state === "ready"`. */
  children: React.ReactNode;
}

/**
 * Renders exactly one branch for a panel: loading, error, guided empty state,
 * or the real content. Keeps the three non-ready states visually and
 * semantically distinct.
 */
export function AnalyticsPanelStateView({
  state,
  onRetry,
  loadingLabel = "Loading analytics…",
  children,
  ...emptyProps
}: AnalyticsPanelStateViewProps) {
  if (state === "loading") {
    return <LoadingState variant="inline" label={loadingLabel} />;
  }

  if (state === "error") {
    return (
      <ErrorState
        title={`Couldn't load ${emptyProps.title.toLowerCase()}`}
        description="This panel failed to load. Your data is unchanged — try again."
        onRetry={onRetry}
      />
    );
  }

  if (state === "empty") {
    return <AnalyticsEmptyState {...emptyProps} />;
  }

  return <>{children}</>;
}
