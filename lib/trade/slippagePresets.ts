/**
 * Slippage tolerance preset helpers (#1102).
 *
 * Presets are the per-trade slippage shortcuts shown in the trade review.
 * The hard ceiling matches the server-side limit in lib/tradeLimits.ts so
 * the UI never lets a user set a value the server will reject.
 *
 * All functions are pure with no side-effects.
 */

import { MAX_SLIPPAGE_PERCENT } from "@/lib/tradeLimits";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum slippage tolerance accepted by the protocol (inclusive). */
export const MIN_SLIPPAGE_PERCENT = 0.1;

/**
 * Re-export for convenience so callers import from one place.
 * Value is 3% — the ceiling enforced by the server.
 */
export { MAX_SLIPPAGE_PERCENT };

/**
 * Default preset buttons shown in the picker.
 * Values are in percent (0.1 = 0.1%).
 */
export const DEFAULT_SLIPPAGE_PRESETS: readonly number[] = [0.1, 0.5, 1, 3];

/** The preset selected before the user changes anything. */
export const DEFAULT_SLIPPAGE_PERCENT = 0.5;

// ── Validation ────────────────────────────────────────────────────────────────

export type SlippageValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Validates a raw string input for slippage tolerance.
 *
 * Rules:
 * - Must be a finite number.
 * - Must be ≥ MIN_SLIPPAGE_PERCENT.
 * - Must be ≤ MAX_SLIPPAGE_PERCENT.
 *
 * Returns the parsed numeric value on success, or an error message on failure.
 */
export function validateSlippage(raw: string): SlippageValidationResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, error: "Slippage tolerance is required" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Slippage must be a number" };
  }
  if (value < MIN_SLIPPAGE_PERCENT) {
    return {
      ok: false,
      error: `Minimum slippage is ${MIN_SLIPPAGE_PERCENT}%`,
    };
  }
  if (value > MAX_SLIPPAGE_PERCENT) {
    return {
      ok: false,
      error: `Maximum slippage is ${MAX_SLIPPAGE_PERCENT}%`,
    };
  }
  return { ok: true, value };
}

// ── minReceived helper ────────────────────────────────────────────────────────

/**
 * Recalculates the minimum amount the user will receive after applying
 * the given slippage tolerance.
 *
 * @param toAmount   - The quoted receive amount as a decimal string.
 * @param slippage   - Slippage tolerance in percent (e.g. 0.5 = 0.5%).
 * @param decimals   - Number of decimal places to keep (default 7, Stellar stroop precision).
 *
 * Returns `null` when `toAmount` cannot be parsed as a positive number.
 */
export function calcMinReceived(
  toAmount: string,
  slippage: number,
  decimals = 7
): string | null {
  const amount = Number(toAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const factor = 1 - slippage / 100;
  const result = amount * factor;
  // Round down (floor) so we never over-promise the minimum.
  const scale = 10 ** decimals;
  const floored = Math.floor(result * scale) / scale;
  return floored.toFixed(decimals).replace(/\.?0+$/, "");
}

// ── Quote-invalidation policy ────────────────────────────────────────────────

/**
 * Describes what a slippage change should do to the pending quote.
 *
 * - `"refresh"` — a live quote fetcher is available; re-fetch with the new
 *   slippage so `minReceived` is re-derived server-side.
 * - `"invalidate"` — no fetcher; mark the quote as needing a refresh before
 *   the user can confirm.
 * - `"recalculate"` — the quote's `toAmount` is available client-side; recompute
 *   `minReceived` locally without a network round-trip.
 */
export type SlippageChangeEffect =
  | "refresh"
  | "invalidate"
  | "recalculate";

/**
 * Decides the appropriate effect given the caller's capabilities.
 *
 * Priority: refresh > recalculate > invalidate.
 */
export function slippageChangeEffect(options: {
  hasRefreshFn: boolean;
  hasToAmount: boolean;
}): SlippageChangeEffect {
  if (options.hasRefreshFn) return "refresh";
  if (options.hasToAmount) return "recalculate";
  return "invalidate";
}

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * Formats a slippage percentage for display, e.g.:
 * - 0.5  → "0.5%"
 * - 1    → "1%"
 * - 1.25 → "1.25%"
 */
export function formatSlippage(value: number): string {
  // Avoid unnecessary trailing zeros.
  return `${parseFloat(value.toFixed(2))}%`;
}
