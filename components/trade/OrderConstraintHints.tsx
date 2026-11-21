"use client";

/**
 * OrderConstraintHints (#1098)
 *
 * Renders applicable order-value and balance constraints beside the amount
 * input so users see actionable feedback before final trade review.
 *
 * Design decisions
 * ─────────────────
 * - Each constraint row is always shown so users can see all limits at once,
 *   not just the one they violated.
 * - "ok" constraints appear as muted hints; "warning" and "error" use colour
 *   and icons. "unavailable" shows a neutral loading or error note — never a
 *   fabricated value.
 * - The list uses role="list" with accessible labels per row so screen readers
 *   announce changes via aria-live as the order value is typed.
 * - Loading and error states follow the patterns from StellarOperationList
 *   (spinner + aria-busy, role="alert").
 * - The component is stateless/pure: the caller owns all constraint data and
 *   the order value.
 */

import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evaluateConstraints,
  type Constraint,
  type ConstraintResult,
  type ConstraintSeverity,
} from "@/lib/trade/orderConstraints";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderConstraintHintsProps {
  /**
   * The constraints to surface. Pass an empty array to show nothing.
   * Never fabricate a constraint if the actual limit is not known —
   * use `limit: null` with a `reason` instead.
   */
  constraints: Constraint[];
  /**
   * Current total order value (amount × price) in the same currency as the
   * constraint limits. Pass 0 or omit when the user has not yet entered an
   * amount — passive labels are shown instead of error/warning states.
   */
  orderValue?: number;
  /** True while constraints are still being fetched. */
  loading?: boolean;
  /** Set when constraints could not be loaded. */
  error?: string | null;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderConstraintHints({
  constraints,
  orderValue = 0,
  loading = false,
  error = null,
  className,
}: OrderConstraintHintsProps) {
  // Loading state.
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading order constraints"
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden="true" />
        <span>Loading order limits…</span>
      </div>
    );
  }

  // Error state.
  if (error) {
    return (
      <p
        role="alert"
        className={cn(
          "flex items-start gap-1.5 text-xs text-destructive",
          className
        )}
      >
        <XCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          {error || "Order limits could not be loaded. Verify limits in your wallet before trading."}
        </span>
      </p>
    );
  }

  // Empty — no constraints provided. Render nothing so the caller's layout
  // is not disrupted by an empty element.
  if (constraints.length === 0) {
    return null;
  }

  const results = evaluateConstraints(constraints, orderValue);

  return (
    <ul
      aria-label="Order constraints"
      aria-live="polite"
      aria-atomic="false"
      className={cn("space-y-1", className)}
    >
      {results.map((result) => (
        <ConstraintRow key={result.kind} result={result} />
      ))}
    </ul>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ConstraintRow({ result }: { result: ConstraintResult }) {
  const { severity, label, message } = result;

  return (
    <li
      aria-label={`${label}: ${message}`}
      className={cn(
        "flex items-start gap-1.5 text-xs",
        severityTextClass(severity)
      )}
    >
      <ConstraintIcon severity={severity} />
      <span>
        <span className="font-medium">{label}:</span>{" "}
        <span>{message}</span>
      </span>
    </li>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ConstraintIcon({ severity }: { severity: ConstraintSeverity }) {
  switch (severity) {
    case "error":
      return (
        <XCircle
          className="mt-0.5 h-3 w-3 shrink-0 text-destructive"
          aria-hidden="true"
        />
      );
    case "warning":
      return (
        <AlertTriangle
          className="mt-0.5 h-3 w-3 shrink-0 text-amber-500"
          aria-hidden="true"
        />
      );
    case "unavailable":
      return (
        <Info
          className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      );
    case "ok":
    default:
      return (
        <CheckCircle2
          className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60"
          aria-hidden="true"
        />
      );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityTextClass(severity: ConstraintSeverity): string {
  switch (severity) {
    case "error":
      return "text-destructive";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "unavailable":
      return "text-muted-foreground";
    case "ok":
    default:
      return "text-muted-foreground";
  }
}
