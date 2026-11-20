import { computeBuyAndHoldBaseline, excessReturnPoints } from "@/lib/backtestBaseline";
import type { BacktestParams, PricePoint } from "@/lib/backtest";

const params: BacktestParams = {
  from: "2024-01-01",
  to: "2024-01-05",
  signals: ["providerA"],
  feeBps: 0,
  slippageBps: 0,
  startingCapital: 1000,
  asset: "XLM",
};

const prices: PricePoint[] = [
  { time: "2024-01-01", price: 0.1 },
  { time: "2024-01-02", price: 0.11 },
  { time: "2024-01-03", price: 0.09 },
  { time: "2024-01-05", price: 0.12 },
];

describe("computeBuyAndHoldBaseline", () => {
  it("holds from the first to the last price of the period", () => {
    const result = computeBuyAndHoldBaseline(params, prices);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.startPrice).toBe(0.1);
    expect(result.endPrice).toBe(0.12);
    expect(result.totalReturn).toBeCloseTo(0.2, 10);
    expect(result.endingValue).toBeCloseTo(1200, 8);
  });

  it("applies the run's fee and slippage on entry and exit", () => {
    const result = computeBuyAndHoldBaseline({ ...params, feeBps: 50, slippageBps: 50 }, prices);
    if (result.status !== "ok") throw new Error("expected ok");
    const cost = 0.01;
    expect(result.totalReturn).toBeCloseTo((1 - cost) * 1.2 * (1 - cost) - 1, 10);
  });

  it("omits the ending value when no starting capital was recorded", () => {
    const result = computeBuyAndHoldBaseline({ ...params, startingCapital: undefined }, prices);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.endingValue).toBeUndefined();
    expect(result.assumptions.find((a) => a.label === "Starting capital")?.value).toMatch(/not recorded/i);
  });

  it("is unavailable, not approximated, without price history", () => {
    for (const history of [undefined, []]) {
      const result = computeBuyAndHoldBaseline(params, history);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") expect(result.reason).toMatch(/no price history/i);
    }
  });

  it("is unavailable when history does not cover the whole period", () => {
    const late = computeBuyAndHoldBaseline(params, prices.slice(1));
    const early = computeBuyAndHoldBaseline(params, prices.slice(0, 3));
    for (const r of [late, early]) {
      expect(r.status).toBe("unavailable");
      if (r.status === "unavailable") expect(r.reason).toMatch(/does not cover/i);
    }
  });

  it("is unavailable for invalid prices, timestamps or ranges", () => {
    expect(computeBuyAndHoldBaseline(params, [...prices, { time: "2024-01-06", price: 0 }]).status).toBe("unavailable");
    expect(computeBuyAndHoldBaseline(params, [{ time: "nope", price: 1 }, ...prices]).status).toBe("unavailable");
    expect(computeBuyAndHoldBaseline({ ...params, from: "2024-02-01" }, prices).status).toBe("unavailable");
  });

  it("always lists its assumptions separately from the result", () => {
    const result = computeBuyAndHoldBaseline(params, undefined);
    expect(result.assumptions.map((a) => a.label)).toEqual(["Asset", "Period", "Starting capital", "Method", "Costs"]);
  });
});

describe("excessReturnPoints", () => {
  it("expresses the difference in percentage points", () => {
    expect(excessReturnPoints(0.25, 0.2)).toBeCloseTo(5, 10);
    expect(excessReturnPoints(0.1, 0.2)).toBeCloseTo(-10, 10);
  });
});
