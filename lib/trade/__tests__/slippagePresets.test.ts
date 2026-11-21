/**
 * Unit tests for slippage tolerance preset helpers (#1102).
 *
 * Covers validation, minReceived recalculation, quote-effect policy,
 * and display formatting.
 */

import {
  validateSlippage,
  calcMinReceived,
  slippageChangeEffect,
  formatSlippage,
  DEFAULT_SLIPPAGE_PRESETS,
  DEFAULT_SLIPPAGE_PERCENT,
  MIN_SLIPPAGE_PERCENT,
  MAX_SLIPPAGE_PERCENT,
} from "@/lib/trade/slippagePresets";

// ── constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("DEFAULT_SLIPPAGE_PERCENT is included in DEFAULT_SLIPPAGE_PRESETS", () => {
    expect(DEFAULT_SLIPPAGE_PRESETS).toContain(DEFAULT_SLIPPAGE_PERCENT);
  });

  it("MAX_SLIPPAGE_PERCENT matches the server-side limit (3)", () => {
    expect(MAX_SLIPPAGE_PERCENT).toBe(3);
  });

  it("MIN_SLIPPAGE_PERCENT is positive", () => {
    expect(MIN_SLIPPAGE_PERCENT).toBeGreaterThan(0);
  });
});

// ── validateSlippage ──────────────────────────────────────────────────────────

describe("validateSlippage", () => {
  it("accepts the minimum boundary", () => {
    const result = validateSlippage(String(MIN_SLIPPAGE_PERCENT));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(MIN_SLIPPAGE_PERCENT);
  });

  it("accepts the maximum boundary", () => {
    const result = validateSlippage(String(MAX_SLIPPAGE_PERCENT));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(MAX_SLIPPAGE_PERCENT);
  });

  it("accepts a mid-range value", () => {
    const result = validateSlippage("1.5");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1.5);
  });

  it("rejects an empty string", () => {
    const result = validateSlippage("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/required/i);
  });

  it("rejects a whitespace-only string", () => {
    const result = validateSlippage("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/required/i);
  });

  it("rejects non-numeric input", () => {
    const result = validateSlippage("abc");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/number/i);
  });

  it("rejects zero (below minimum)", () => {
    const result = validateSlippage("0");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/minimum/i);
  });

  it("rejects a value below the minimum", () => {
    const result = validateSlippage("0.05");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/minimum/i);
  });

  it("rejects a value above the maximum", () => {
    const result = validateSlippage("5");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/maximum/i);
  });

  it("rejects a negative value", () => {
    const result = validateSlippage("-1");
    expect(result.ok).toBe(false);
  });

  it("strips surrounding whitespace before parsing", () => {
    const result = validateSlippage("  1  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1);
  });
});

// ── calcMinReceived ───────────────────────────────────────────────────────────

describe("calcMinReceived", () => {
  it("applies 0.5% slippage correctly", () => {
    // 100 * (1 - 0.005) = 99.5
    expect(calcMinReceived("100", 0.5)).toBe("99.5");
  });

  it("applies 1% slippage correctly", () => {
    // 50 * (1 - 0.01) = 49.5
    expect(calcMinReceived("50", 1)).toBe("49.5");
  });

  it("applies 3% slippage (maximum) correctly", () => {
    // 100 * (1 - 0.03) = 97.0
    expect(calcMinReceived("100", 3)).toBe("97");
  });

  it("floors rather than rounds to avoid over-promising", () => {
    // 100 * (1 - 0.009) = 99.1 — no rounding artifact
    const result = calcMinReceived("100", 0.9);
    // Should not exceed 100 * 0.991 = 99.1
    expect(Number(result)).toBeLessThanOrEqual(99.1);
  });

  it("returns null for a zero amount", () => {
    expect(calcMinReceived("0", 0.5)).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(calcMinReceived("-10", 0.5)).toBeNull();
  });

  it("returns null for a non-numeric string", () => {
    expect(calcMinReceived("abc", 0.5)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(calcMinReceived("", 0.5)).toBeNull();
  });

  it("honours custom decimal precision", () => {
    const result = calcMinReceived("100", 0.5, 2);
    expect(result).toBe("99.5");
  });
});

// ── slippageChangeEffect ──────────────────────────────────────────────────────

describe("slippageChangeEffect", () => {
  it("prefers refresh when a fetcher is available", () => {
    expect(
      slippageChangeEffect({ hasRefreshFn: true, hasToAmount: true })
    ).toBe("refresh");
  });

  it("falls back to recalculate when toAmount is known but no fetcher", () => {
    expect(
      slippageChangeEffect({ hasRefreshFn: false, hasToAmount: true })
    ).toBe("recalculate");
  });

  it("invalidates when neither fetcher nor toAmount is available", () => {
    expect(
      slippageChangeEffect({ hasRefreshFn: false, hasToAmount: false })
    ).toBe("invalidate");
  });
});

// ── formatSlippage ────────────────────────────────────────────────────────────

describe("formatSlippage", () => {
  it("formats 0.5 as '0.5%'", () => {
    expect(formatSlippage(0.5)).toBe("0.5%");
  });

  it("formats 1 as '1%' without trailing decimal", () => {
    expect(formatSlippage(1)).toBe("1%");
  });

  it("formats 3 as '3%'", () => {
    expect(formatSlippage(3)).toBe("3%");
  });

  it("formats 1.25 as '1.25%'", () => {
    expect(formatSlippage(1.25)).toBe("1.25%");
  });

  it("strips excess trailing zeros", () => {
    expect(formatSlippage(1.5)).toBe("1.5%");
  });
});
