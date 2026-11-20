import { findMaxDrawdownInterval } from "@/lib/backtestDrawdown";
import type { EquityPoint } from "@/lib/backtest";

const day = (n: number) => `2024-01-${String(n).padStart(2, "0")}`;
const curve = (values: number[]): EquityPoint[] => values.map((equity, i) => ({ time: day(i + 1), equity }));

describe("findMaxDrawdownInterval", () => {
  it("locates peak, trough and recovery of the worst drawdown", () => {
    const result = findMaxDrawdownInterval(curve([100, 120, 90, 100, 130, 110, 125]));
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.peak).toMatchObject({ index: 1, equity: 120 });
    expect(result.trough).toMatchObject({ index: 2, equity: 90 });
    expect(result.recovery).toMatchObject({ index: 4, equity: 130 });
    expect(result.depth).toBeCloseTo(0.25, 10);
  });

  it("picks the deeper of two drawdowns", () => {
    const result = findMaxDrawdownInterval(curve([100, 90, 100, 150, 60, 80]));
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.peak.index).toBe(3);
    expect(result.trough.index).toBe(4);
    expect(result.depth).toBeCloseTo(0.6, 10);
  });

  it("discloses a drawdown that never recovered", () => {
    const result = findMaxDrawdownInterval(curve([100, 140, 100, 110]));
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.recovery).toBeNull();
    expect(result.notes.join(" ")).toMatch(/had not regained/i);
  });

  it("discloses a coarse curve and a mismatch with the reported metric", () => {
    const result = findMaxDrawdownInterval(curve([100, 120, 90, 130]), 0.5);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.notes.join(" ")).toMatch(/Only 4 equity points/);
    expect(result.notes.join(" ")).toMatch(/differs from the reported 50.00%/);
  });

  it("does not flag a mismatch inside the tolerance", () => {
    const values = Array.from({ length: 12 }, (_, i) => (i === 5 ? 90 : 100));
    const result = findMaxDrawdownInterval(curve(values), 0.103);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.notes.some((n) => n.includes("differs"))).toBe(false);
  });

  it("reports no drawdown for a curve that only rises", () => {
    const result = findMaxDrawdownInterval(curve([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(result.status).toBe("none");
  });

  it("is unavailable for missing, short, invalid or unordered curves", () => {
    expect(findMaxDrawdownInterval(undefined).status).toBe("unavailable");
    expect(findMaxDrawdownInterval([]).status).toBe("unavailable");
    expect(findMaxDrawdownInterval(curve([100])).status).toBe("unavailable");
    expect(findMaxDrawdownInterval(curve([100, 0, 90])).status).toBe("unavailable");
    expect(findMaxDrawdownInterval([{ time: "bad", equity: 1 }, { time: day(2), equity: 2 }]).status).toBe("unavailable");
    expect(findMaxDrawdownInterval([{ time: day(3), equity: 1 }, { time: day(2), equity: 2 }]).status).toBe("unavailable");
  });
});
