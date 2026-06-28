/**
 * Trade form validation schemas using Zod.
 *
 * Provides reusable, composable schemas for both MARKET and LIMIT order forms.
 * Import `validateTradeField` as a drop-in replacement for the manual
 * `validateField` function, or use the full schemas with a form library.
 */

import { z } from "zod";

// ── Shared field schemas ──────────────────────────────────────────────────────

/**
 * Validates a numeric amount field (XLM quantity, etc.).
 * Matches the error messages produced by the legacy validateField function.
 */
export const amountSchema = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .refine((v) => !isNaN(Number(v)), { message: "Amount must be a number" })
  .refine((v) => Number(v) > 0, { message: "Amount must be greater than 0" });

/**
 * Validates a limit price field (USDC value).
 * Only relevant for LIMIT orders; MARKET orders should skip this field.
 */
export const limitPriceSchema = z
  .string()
  .trim()
  .min(1, "Limit price is required")
  .refine((v) => !isNaN(Number(v)), { message: "Limit price must be a number" })
  .refine((v) => Number(v) > 0, { message: "Limit price must be greater than 0" });

// ── Order-type-specific schemas ───────────────────────────────────────────────

/** Full schema for a LIMIT order submission. */
export const limitOrderSchema = z.object({
  orderType: z.literal("LIMIT"),
  amount: amountSchema,
  limitPrice: limitPriceSchema,
});

/** Full schema for a MARKET order submission. */
export const marketOrderSchema = z.object({
  orderType: z.literal("MARKET"),
  amount: amountSchema,
});

/** Discriminated union covering both order types. */
export const tradeOrderSchema = z.discriminatedUnion("orderType", [
  limitOrderSchema,
  marketOrderSchema,
]);

export type LimitOrder = z.infer<typeof limitOrderSchema>;
export type MarketOrder = z.infer<typeof marketOrderSchema>;
export type TradeOrder = z.infer<typeof tradeOrderSchema>;

// ── Compatibility helper ──────────────────────────────────────────────────────

/**
 * Drop-in replacement for the legacy `validateField` function.
 *
 * Validates a single string field value using the appropriate Zod schema and
 * returns the first error message, or `""` if valid.
 *
 * @param value - The raw string value from the input.
 * @param label - The human-readable field name used in error messages
 *   (`"Amount"` | `"Limit price"`).
 * @returns The first validation error message, or `""` when the value is valid.
 *
 * @example
 * validateTradeField("", "Amount")       // "Amount is required"
 * validateTradeField("abc", "Amount")    // "Amount must be a number"
 * validateTradeField("-5", "Amount")     // "Amount must be greater than 0"
 * validateTradeField("100", "Amount")    // ""
 */
export function validateTradeField(value: string, label: string): string {
  const schema =
    label.toLowerCase().includes("limit price") || label.toLowerCase().includes("limit")
      ? limitPriceSchema
      : amountSchema;

  const result = schema.safeParse(value);
  if (result.success) return "";

  // Replace the generic field name with the caller-supplied label
  const firstMessage = result.error.issues[0]?.message ?? "";
  return firstMessage
    .replace(/^Amount/, label)
    .replace(/^Limit price/, label);
}
