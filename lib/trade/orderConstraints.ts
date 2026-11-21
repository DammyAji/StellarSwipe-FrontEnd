/**
 * Order constraint helpers (#1098).
 *
 * Defines the constraint types that can apply to a trade amount input, and
 * evaluates them against a candidate order value to produce actionable inline
 * feedback. All functions are pure with no side-effects.
 *
 * Design principles
 * ─────────────────
 * - Unknown values are never guessed. A constraint whose limit is `null` or
 *   `undefined` is surfaced as "unavailable" so the UI can render a loading
 *   or error state rather than a fabricated number.
 * - Each evaluated constraint carries a `severity` so the UI can style and
 *   announce it appropriately without duplicating that logic.
 * - The order value used for evaluation is the *total order cost* (amount ×
 *   price), not the raw asset amount, so balance checks are apples-to-apples.
 */

// ── Constraint definitions ────────────────────────────────────────────────────

/**
 * Kinds of constraint the amount input should surface.
 *
 * - `minOrderValue`      — protocol or venue minimum trade value (USD/USDC).
 * - `maxOrderValue`      — optional venue-imposed maximum.
 * - `availableBalance`   — spendable wallet balance for this asset.
 * - `positionLimit`      — user-configured per-trade portfolio percentage cap.
 */
export type ConstraintKind =
  | "minOrderValue"
  | "maxOrderValue"
  | "availableBalance"
  | "positionLimit";

/** A constraint whose limit value is known and ready to evaluate against. */
export interface KnownConstraint {
  kind: ConstraintKind;
  /** The numeric limit for this constraint (same currency as `orderValue`). */
  limit: number;
  /** Human-readable label for the limit source, e.g. "Wallet balance". */
  label: string;
}

/** A constraint whose limit could not be loaded (loading or error). */
export interface UnavailableConstraint {
  kind: ConstraintKind;
  limit: null;
  label: string;
  /** Why the value is unavailable, e.g. "Loading…" or an error message. */
  reason: string;
}

export type Constraint = KnownConstraint | UnavailableConstraint;

// ── Evaluation ────────────────────────────────────────────────────────────────

/**
 * Severity of a constraint check:
 * - `ok`          — within limits.
 * - `warning`     — approaching a limit (within the warning threshold).
 * - `error`       — outside the limit; the order should be blocked.
 * - `unavailable` — limit value could not be loaded; do not block but warn.
 */
export type ConstraintSeverity = "ok" | "warning" | "error" | "unavailable";

/** How close to a limit triggers a warning (5 % of the limit). */
export const CONSTRAINT_WARNING_THRESHOLD = 0.05;

export interface ConstraintResult {
  kind: ConstraintKind;
  label: string;
  severity: ConstraintSeverity;
  /** Actionable message shown beside the input. Never empty when severity ≠ "ok". */
  message: string;
  /** The constraint's limit, null when unavailable. */
  limit: number | null;
  /** The order value that was evaluated. */
  orderValue: number;
}

/**
 * Evaluates a single constraint against the current order value.
 *
 * @param constraint - The constraint definition.
 * @param orderValue - The total order cost (amount × price) in the same
 *   currency as the constraint limit.
 */
export function evaluateConstraint(
  constraint: Constraint,
  orderValue: number
): ConstraintResult {
  if (constraint.limit === null) {
    return {
      kind: constraint.kind,
      label: constraint.label,
      severity: "unavailable",
      message: constraint.reason,
      limit: null,
      orderValue,
    };
  }

  const { kind, limit, label } = constraint;

  // No order entered yet — show the constraint passively.
  if (!Number.isFinite(orderValue) || orderValue <= 0) {
    return {
      kind,
      label,
      severity: "ok",
      message: formatPassiveMessage(kind, limit),
      limit,
      orderValue,
    };
  }

  if (kind === "minOrderValue") {
    if (orderValue < limit) {
      return {
        kind,
        label,
        severity: "error",
        message: `Minimum order is ${formatCurrency(limit)}. Enter at least ${formatCurrency(limit)}.`,
        limit,
        orderValue,
      };
    }
    if (orderValue < limit * (1 + CONSTRAINT_WARNING_THRESHOLD)) {
      return {
        kind,
        label,
        severity: "ok", // just above minimum — no need to warn
        message: `Minimum: ${formatCurrency(limit)}`,
        limit,
        orderValue,
      };
    }
    return {
      kind,
      label,
      severity: "ok",
      message: `Minimum: ${formatCurrency(limit)}`,
      limit,
      orderValue,
    };
  }

  if (kind === "maxOrderValue") {
    if (orderValue > limit) {
      return {
        kind,
        label,
        severity: "error",
        message: `Order exceeds maximum of ${formatCurrency(limit)} by ${formatCurrency(orderValue - limit)}.`,
        limit,
        orderValue,
      };
    }
    const nearLimit = limit * (1 - CONSTRAINT_WARNING_THRESHOLD);
    if (orderValue >= nearLimit && orderValue < limit) {
      return {
        kind,
        label,
        severity: "warning",
        message: `Approaching maximum of ${formatCurrency(limit)}.`,
        limit,
        orderValue,
      };
    }
    return {
      kind,
      label,
      severity: "ok",
      message: `Maximum: ${formatCurrency(limit)}`,
      limit,
      orderValue,
    };
  }

  if (kind === "availableBalance") {
    if (orderValue > limit) {
      const shortfall = orderValue - limit;
      return {
        kind,
        label,
        severity: "error",
        message: `Insufficient balance. You need ${formatCurrency(shortfall)} more (available: ${formatCurrency(limit)}).`,
        limit,
        orderValue,
      };
    }
    const nearLimit = limit * (1 - CONSTRAINT_WARNING_THRESHOLD);
    if (orderValue >= nearLimit && orderValue < limit) {
      return {
        kind,
        label,
        severity: "warning",
        message: `You will use almost all of your available ${formatCurrency(limit)}.`,
        limit,
        orderValue,
      };
    }
    return {
      kind,
      label,
      severity: "ok",
      message: `Available: ${formatCurrency(limit)}`,
      limit,
      orderValue,
    };
  }

  // positionLimit
  if (orderValue > limit) {
    const excess = orderValue - limit;
    return {
      kind,
      label,
      severity: "error",
      message: `Exceeds position limit of ${formatCurrency(limit)} by ${formatCurrency(excess)}. Reduce the amount or adjust your limit.`,
      limit,
      orderValue,
    };
  }
  const nearLimit = limit * (1 - CONSTRAINT_WARNING_THRESHOLD);
  if (orderValue >= nearLimit && orderValue < limit) {
    return {
      kind,
      label,
      severity: "warning",
      message: `Approaching position limit of ${formatCurrency(limit)}.`,
      limit,
      orderValue,
    };
  }
  return {
    kind,
    label,
    severity: "ok",
    message: `Position limit: ${formatCurrency(limit)}`,
    limit,
    orderValue,
  };
}

/**
 * Evaluates all constraints and returns results in the same order.
 * Pass an empty array to get an empty result — no fabricated constraints.
 */
export function evaluateConstraints(
  constraints: Constraint[],
  orderValue: number
): ConstraintResult[] {
  return constraints.map((c) => evaluateConstraint(c, orderValue));
}

/**
 * Returns `true` when any evaluated constraint has severity `"error"`,
 * indicating the order should be blocked.
 */
export function hasBlockingConstraint(results: ConstraintResult[]): boolean {
  return results.some((r) => r.severity === "error");
}

// ── Display helpers ───────────────────────────────────────────────────────────

/** Formats a USD/USDC value as a compact string, e.g. "$12.34". */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Passive message shown when no order value has been entered yet. */
function formatPassiveMessage(kind: ConstraintKind, limit: number): string {
  switch (kind) {
    case "minOrderValue":
      return `Minimum order: ${formatCurrency(limit)}`;
    case "maxOrderValue":
      return `Maximum order: ${formatCurrency(limit)}`;
    case "availableBalance":
      return `Available: ${formatCurrency(limit)}`;
    case "positionLimit":
      return `Position limit: ${formatCurrency(limit)}`;
  }
}
