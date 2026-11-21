/**
 * @jest-environment jsdom
 *
 * Component tests for OrderConstraintHints (#1098).
 *
 * Covers:
 * - Loading state: spinner, role="status", aria-label
 * - Error state: role="alert"
 * - Empty: renders nothing when constraints array is empty
 * - Passive (no order value): all constraints shown as "ok" hints
 * - minOrderValue: error when below, ok when above
 * - maxOrderValue: error when above, warning near ceiling, ok well below
 * - availableBalance: error when exceeded, warning near limit, ok with room
 * - positionLimit: error when exceeded, warning near limit
 * - Unavailable constraint: neutral hint, no fabricated value, not blocking
 * - Mixed constraints: each row has an accessible label
 * - aria-live polite on the list (screen-reader announcements)
 * - Unknown-limit constraint never shows a fabricated number
 */

import { render, screen, within } from "@testing-library/react";
import { OrderConstraintHints } from "@/components/trade/OrderConstraintHints";
import type { Constraint } from "@/lib/trade/orderConstraints";

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

// ── helpers ───────────────────────────────────────────────────────────────────

function minConstraint(limit: number): Constraint {
  return { kind: "minOrderValue", limit, label: "Min. order" };
}

function balanceConstraint(limit: number): Constraint {
  return { kind: "availableBalance", limit, label: "Available balance" };
}

function positionConstraint(limit: number): Constraint {
  return { kind: "positionLimit", limit, label: "Position limit" };
}

function maxConstraint(limit: number): Constraint {
  return { kind: "maxOrderValue", limit, label: "Max. order" };
}

function unavailableConstraint(reason = "Loading…"): Constraint {
  return {
    kind: "availableBalance",
    limit: null,
    label: "Available balance",
    reason,
  };
}

// ── Loading state ─────────────────────────────────────────────────────────────

describe("OrderConstraintHints — loading state", () => {
  it("shows a loading spinner with role='status'", () => {
    render(<OrderConstraintHints constraints={[]} loading />);
    expect(
      screen.getByRole("status", { name: /loading order constraints/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/loading order limits/i)).toBeInTheDocument();
  });

  it("does not render a list while loading", () => {
    render(<OrderConstraintHints constraints={[minConstraint(10)]} loading />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

// ── Error state ───────────────────────────────────────────────────────────────

describe("OrderConstraintHints — error state", () => {
  it("shows role='alert' with the error message", () => {
    render(
      <OrderConstraintHints
        constraints={[]}
        error="Failed to load order limits"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /failed to load order limits/i
    );
  });

  it("shows a fallback message when error is a non-empty string but generic", () => {
    render(<OrderConstraintHints constraints={[]} error="something went wrong" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("does not render a list in error state", () => {
    render(
      <OrderConstraintHints constraints={[minConstraint(10)]} error="oops" />
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("OrderConstraintHints — empty state", () => {
  it("renders nothing when constraints array is empty", () => {
    const { container } = render(
      <OrderConstraintHints constraints={[]} />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ── Passive state (no order value) ───────────────────────────────────────────

describe("OrderConstraintHints — passive (no order value)", () => {
  it("renders a list with one row per constraint", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10), balanceConstraint(500)]}
        orderValue={0}
      />
    );
    const list = screen.getByRole("list", { name: /order constraints/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the minimum order passively", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10)]}
        orderValue={0}
      />
    );
    expect(screen.getByText(/minimum order/i)).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
  });

  it("shows available balance passively", () => {
    render(
      <OrderConstraintHints
        constraints={[balanceConstraint(500)]}
        orderValue={0}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(/available/i);
    expect(item).toHaveTextContent(/\$500\.00/);
  });
});

// ── minOrderValue ─────────────────────────────────────────────────────────────

describe("OrderConstraintHints — minOrderValue", () => {
  it("shows an error when order is below minimum", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10)]}
        orderValue={5}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(/minimum order is \$10\.00/i);
  });

  it("accessible label includes the message", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10)]}
        orderValue={5}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item.getAttribute("aria-label")).toMatch(/minimum order is/i);
  });

  it("shows ok when order is above minimum", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10)]}
        orderValue={50}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(/minimum/i);
    // No destructive text class — just a hint
    expect(screen.queryByText(/minimum order is/i)).not.toBeInTheDocument();
  });
});

// ── maxOrderValue ─────────────────────────────────────────────────────────────

describe("OrderConstraintHints — maxOrderValue", () => {
  it("shows error when order exceeds maximum", () => {
    render(
      <OrderConstraintHints
        constraints={[maxConstraint(100)]}
        orderValue={150}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(/exceeds maximum/i);
  });

  it("shows warning when approaching maximum", () => {
    render(
      <OrderConstraintHints
        constraints={[maxConstraint(100)]}
        orderValue={97}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      /approaching maximum/i
    );
  });

  it("shows ok when well below maximum", () => {
    render(
      <OrderConstraintHints
        constraints={[maxConstraint(100)]}
        orderValue={50}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).not.toHaveTextContent(/exceeds/i);
    expect(item).not.toHaveTextContent(/approaching/i);
  });
});

// ── availableBalance ──────────────────────────────────────────────────────────

describe("OrderConstraintHints — availableBalance", () => {
  it("shows error with shortfall when balance is exceeded", () => {
    render(
      <OrderConstraintHints
        constraints={[balanceConstraint(100)]}
        orderValue={150}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(/insufficient balance/i);
    expect(item).toHaveTextContent(/\$50\.00/); // shortfall
    expect(item).toHaveTextContent(/\$100\.00/); // available
  });

  it("shows warning when almost using all balance", () => {
    render(
      <OrderConstraintHints
        constraints={[balanceConstraint(100)]}
        orderValue={96}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(/almost all/i);
  });

  it("shows ok when plenty of balance remains", () => {
    render(
      <OrderConstraintHints
        constraints={[balanceConstraint(1000)]}
        orderValue={100}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).not.toHaveTextContent(/insufficient/i);
    expect(item).not.toHaveTextContent(/almost/i);
  });
});

// ── positionLimit ─────────────────────────────────────────────────────────────

describe("OrderConstraintHints — positionLimit", () => {
  it("shows error with excess when position limit is exceeded", () => {
    render(
      <OrderConstraintHints
        constraints={[positionConstraint(100)]}
        orderValue={120}
      />
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(/exceeds position limit/i);
    expect(item).toHaveTextContent(/\$20\.00/); // excess
  });

  it("shows warning when approaching position limit", () => {
    render(
      <OrderConstraintHints
        constraints={[positionConstraint(100)]}
        orderValue={97}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      /approaching position limit/i
    );
  });
});

// ── unavailable constraint ────────────────────────────────────────────────────

describe("OrderConstraintHints — unavailable constraint", () => {
  it("shows the reason text, not a fabricated value", () => {
    render(
      <OrderConstraintHints
        constraints={[unavailableConstraint("Balance unavailable")]}
        orderValue={50}
      />
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      /balance unavailable/i
    );
  });

  it("does not show a dollar amount when value is unavailable", () => {
    render(
      <OrderConstraintHints
        constraints={[unavailableConstraint("Loading…")]}
        orderValue={50}
      />
    );
    // No fabricated dollar figure.
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
  });
});

// ── Mixed constraints ─────────────────────────────────────────────────────────

describe("OrderConstraintHints — mixed constraints", () => {
  it("renders all constraint rows in order", () => {
    render(
      <OrderConstraintHints
        constraints={[
          minConstraint(10),
          balanceConstraint(500),
          positionConstraint(200),
        ]}
        orderValue={50}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
  });

  it("each row has an accessible aria-label", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10), balanceConstraint(500)]}
        orderValue={50}
      />
    );
    screen.getAllByRole("listitem").forEach((item) => {
      expect(item).toHaveAttribute("aria-label");
      expect(item.getAttribute("aria-label")).not.toBe("");
    });
  });

  it("list has aria-live polite for screen-reader announcements", () => {
    render(
      <OrderConstraintHints
        constraints={[minConstraint(10)]}
        orderValue={5}
      />
    );
    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });
});
