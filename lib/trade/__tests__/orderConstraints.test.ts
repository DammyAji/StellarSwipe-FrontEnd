/**
 * Unit tests for order constraint helpers (#1098).
 *
 * Covers every ConstraintKind (minOrderValue, maxOrderValue,
 * availableBalance, positionLimit), the unavailable path, the warning
 * threshold, hasBlockingConstraint, evaluateConstraints (batch), and
 * formatCurrency.
 */

import {
  evaluateConstraint,
  evaluateConstraints,
  hasBlockingConstraint,
  formatCurrency,
  CONSTRAINT_WARNING_THRESHOLD,
  type KnownConstraint,
  type UnavailableConstraint,
} from "@/lib/trade/orderConstraints";

// ── helpers ───────────────────────────────────────────────────────────────────

function known(
  kind: KnownConstraint["kind"],
  limit: number,
  label = "Test"
): KnownConstraint {
  return { kind, limit, label };
}

function unavailable(
  kind: KnownConstraint["kind"],
  reason = "Loading…"
): UnavailableConstraint {
  return { kind, limit: null, label: "Test", reason };
}

// ── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a whole number", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("formats a decimal value", () => {
    expect(formatCurrency(12.5)).toBe("$12.50");
  });

  it("formats a large number with commas", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("returns '—' for non-finite input", () => {
    expect(formatCurrency(NaN)).toBe("—");
    expect(formatCurrency(Infinity)).toBe("—");
  });
});

// ── unavailable constraint ────────────────────────────────────────────────────

describe("unavailable constraint", () => {
  it("returns severity 'unavailable' with the reason as message", () => {
    const result = evaluateConstraint(
      unavailable("availableBalance", "Balance unavailable"),
      50
    );
    expect(result.severity).toBe("unavailable");
    expect(result.message).toBe("Balance unavailable");
    expect(result.limit).toBeNull();
  });

  it("does not block the order (severity is not 'error')", () => {
    const result = evaluateConstraint(unavailable("minOrderValue"), 0);
    expect(result.severity).not.toBe("error");
  });
});

// ── passive state (no order value) ───────────────────────────────────────────

describe("passive state (orderValue = 0)", () => {
  it("shows minimum order passively for minOrderValue", () => {
    const result = evaluateConstraint(known("minOrderValue", 10), 0);
    expect(result.severity).toBe("ok");
    expect(result.message).toMatch(/minimum order/i);
    expect(result.message).toContain("$10.00");
  });

  it("shows available balance passively for availableBalance", () => {
    const result = evaluateConstraint(known("availableBalance", 500), 0);
    expect(result.severity).toBe("ok");
    expect(result.message).toMatch(/available/i);
  });
});

// ── minOrderValue ────���────────────────────────────────────────────────────────

describe("minOrderValue", () => {
  it("returns 'error' when orderValue is below the minimum", () => {
    const result = evaluateConstraint(known("minOrderValue", 10), 5);
    expect(result.severity).toBe("error");
    expect(result.message).toMatch(/minimum order is \$10\.00/i);
  });

  it("returns 'ok' when orderValue equals the minimum", () => {
    const result = evaluateConstraint(known("minOrderValue", 10), 10);
    expect(result.severity).toBe("ok");
  });

  it("returns 'ok' when orderValue is above the minimum", () => {
    const result = evaluateConstraint(known("minOrderValue", 10), 100);
    expect(result.severity).toBe("ok");
  });

  it("message names the minimum value", () => {
    const result = evaluateConstraint(known("minOrderValue", 25), 10);
    expect(result.message).toContain("$25.00");
  });
});

// ── maxOrderValue ─────────────────────────────────────────────────────────────

describe("maxOrderValue", () => {
  it("returns 'error' when orderValue exceeds the maximum", () => {
    const result = evaluateConstraint(known("maxOrderValue", 100), 150);
    expect(result.severity).toBe("error");
    expect(result.message).toMatch(/exceeds maximum/i);
    expect(result.message).toContain("$50.00"); // excess
  });

  it("returns 'warning' when orderValue is within the warning threshold", () => {
    // 95% of 100 = 95 — within 5% of the ceiling
    const result = evaluateConstraint(known("maxOrderValue", 100), 96);
    expect(result.severity).toBe("warning");
    expect(result.message).toMatch(/approaching maximum/i);
  });

  it("returns 'ok' well below the maximum", () => {
    const result = evaluateConstraint(known("maxOrderValue", 100), 50);
    expect(result.severity).toBe("ok");
  });

  it("returns 'ok' when orderValue equals the maximum", () => {
    const result = evaluateConstraint(known("maxOrderValue", 100), 100);
    expect(result.severity).toBe("ok");
  });
});

// ── availableBalance ──────────────────────────────────────────────────────────

describe("availableBalance", () => {
  it("returns 'error' when orderValue exceeds the available balance", () => {
    const result = evaluateConstraint(known("availableBalance", 100), 150);
    expect(result.severity).toBe("error");
    expect(result.message).toMatch(/insufficient balance/i);
    expect(result.message).toContain("$50.00"); // shortfall
    expect(result.message).toContain("$100.00"); // available
  });

  it("returns 'warning' when order uses almost all of the balance", () => {
    // 96% of 100 = 96 — within 5% of the balance
    const result = evaluateConstraint(known("availableBalance", 100), 96);
    expect(result.severity).toBe("warning");
    expect(result.message).toMatch(/almost all/i);
  });

  it("returns 'ok' when plenty of balance remains", () => {
    const result = evaluateConstraint(known("availableBalance", 1000), 100);
    expect(result.severity).toBe("ok");
  });

  it("includes the available amount in the ok message", () => {
    const result = evaluateConstraint(known("availableBalance", 500), 0);
    expect(result.message).toContain("$500.00");
  });
});

// ── positionLimit ─────────────────────────────────────────────────────────────

describe("positionLimit", () => {
  it("returns 'error' when orderValue exceeds the position limit", () => {
    const result = evaluateConstraint(known("positionLimit", 100), 120);
    expect(result.severity).toBe("error");
    expect(result.message).toMatch(/exceeds position limit/i);
    expect(result.message).toContain("$20.00"); // excess
  });

  it("returns 'warning' when approaching the position limit", () => {
    // 97% of 100 = 97 — within 5%
    const result = evaluateConstraint(known("positionLimit", 100), 97);
    expect(result.severity).toBe("warning");
    expect(result.message).toMatch(/approaching position limit/i);
  });

  it("returns 'ok' well below the limit", () => {
    const result = evaluateConstraint(known("positionLimit", 100), 50);
    expect(result.severity).toBe("ok");
  });

  it("includes the limit in the ok passive message", () => {
    const result = evaluateConstraint(known("positionLimit", 200), 0);
    expect(result.message).toContain("$200.00");
  });
});

// ── evaluateConstraints (batch) ───────────────────────────────────────────────

describe("evaluateConstraints", () => {
  it("maps all constraints in order", () => {
    const constraints = [
      known("minOrderValue", 10),
      known("availableBalance", 500),
    ];
    const results = evaluateConstraints(constraints, 50);
    expect(results).toHaveLength(2);
    expect(results[0].kind).toBe("minOrderValue");
    expect(results[1].kind).toBe("availableBalance");
  });

  it("returns an empty array for an empty input", () => {
    expect(evaluateConstraints([], 100)).toEqual([]);
  });

  it("evaluates mixed known and unavailable constraints", () => {
    const constraints = [
      known("availableBalance", 100),
      unavailable("minOrderValue", "Loading…"),
    ];
    const results = evaluateConstraints(constraints, 50);
    expect(results[0].severity).toBe("ok");
    expect(results[1].severity).toBe("unavailable");
  });
});

// ── hasBlockingConstraint ────────────────────────────────────────────────────

describe("hasBlockingConstraint", () => {
  it("returns true when any result has severity 'error'", () => {
    const results = evaluateConstraints(
      [known("availableBalance", 100)],
      150
    );
    expect(hasBlockingConstraint(results)).toBe(true);
  });

  it("returns false when all results are 'ok'", () => {
    const results = evaluateConstraints(
      [known("availableBalance", 100)],
      50
    );
    expect(hasBlockingConstraint(results)).toBe(false);
  });

  it("returns false when results contain 'warning' but not 'error'", () => {
    const results = evaluateConstraints(
      [known("availableBalance", 100)],
      96 // warning zone
    );
    expect(hasBlockingConstraint(results)).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(hasBlockingConstraint([])).toBe(false);
  });

  it("returns false when only unavailable constraints are present", () => {
    const results = evaluateConstraints(
      [unavailable("availableBalance", "Loading…")],
      100
    );
    expect(hasBlockingConstraint(results)).toBe(false);
  });
});

// ── CONSTRAINT_WARNING_THRESHOLD ─────────────────────────────────────────────

describe("CONSTRAINT_WARNING_THRESHOLD", () => {
  it("is a positive fraction less than 1", () => {
    expect(CONSTRAINT_WARNING_THRESHOLD).toBeGreaterThan(0);
    expect(CONSTRAINT_WARNING_THRESHOLD).toBeLessThan(1);
  });

  it("triggers warning at the documented threshold for availableBalance", () => {
    const limit = 100;
    const justInsideThreshold = limit * (1 - CONSTRAINT_WARNING_THRESHOLD);
    const justOutsideThreshold = justInsideThreshold - 0.01;

    expect(
      evaluateConstraint(known("availableBalance", limit), justInsideThreshold)
        .severity
    ).toBe("warning");
    expect(
      evaluateConstraint(known("availableBalance", limit), justOutsideThreshold)
        .severity
    ).toBe("ok");
  });
});
