import { explainNoTrades, NO_TRADES_UNKNOWN_NOTE, periodDays } from "@/lib/backtestNoTrades";
import type { BacktestParams } from "@/lib/backtest";

const params: BacktestParams = { from: "2023-01-01", to: "2023-12-31", signals: ["providerA"], feeBps: 10, slippageBps: 10 };
const none = { trades: [] };
const some = { trades: [{ time: "2023-02-01", pnl: 1 }] };

describe("periodDays", () => {
  it("counts days inclusively and rejects invalid dates", () => {
    expect(periodDays("2024-01-01", "2024-01-01")).toBe(1);
    expect(periodDays("2024-01-01", "2024-01-07")).toBe(7);
    expect(periodDays("2024-01-02", "2024-01-01")).toBe(0);
    expect(periodDays("nope", "2024-01-01")).toBeNull();
  });
});

describe("explainNoTrades", () => {
  it("is not applicable when the run produced trades or the result is missing", () => {
    expect(explainNoTrades(params, some).applicable).toBe(false);
    expect(explainNoTrades(params, undefined).applicable).toBe(false);
  });

  it("reports no constraints, and still states what is unknown, for healthy inputs", () => {
    const e = explainNoTrades(params, none);
    expect(e.applicable).toBe(true);
    expect(e.constraints).toEqual([]);
    expect(e.unknownNote).toBe(NO_TRADES_UNKNOWN_NOTE);
  });

  it("identifies a missing signal selection and links to that input", () => {
    const e = explainNoTrades({ ...params, signals: [] }, none);
    expect(e.constraints).toEqual([expect.objectContaining({ id: "no-signals", inputId: "backtest-signals" })]);
  });

  it("identifies short and inverted periods", () => {
    const short = explainNoTrades({ ...params, from: "2023-03-01", to: "2023-03-03" }, none);
    expect(short.constraints[0]).toMatchObject({ id: "short-period", inputId: "backtest-from" });
    expect(short.constraints[0].message).toContain("3 days");
    const one = explainNoTrades({ ...params, from: "2023-03-01", to: "2023-03-01" }, none);
    expect(one.constraints[0].message).toContain("1 day long");
    const inverted = explainNoTrades({ ...params, from: "2023-03-05", to: "2023-03-01" }, none);
    expect(inverted.constraints[0].id).toBe("invalid-period");
  });

  it("mentions high costs without claiming they caused the result", () => {
    const e = explainNoTrades({ ...params, feeBps: 80, slippageBps: 40 }, none);
    expect(e.constraints[0]).toMatchObject({ id: "high-costs", inputId: "backtest-fee" });
    expect(e.constraints[0].message).toContain("120 bps");
    expect(e.constraints[0].message).toMatch(/cannot show whether/);
  });

  it("can report several constraints at once and never invents causes for unknown inputs", () => {
    const e = explainNoTrades({ signals: [] }, none);
    expect(e.constraints.map((c) => c.id)).toEqual(["no-signals"]);
    expect(explainNoTrades(undefined, none).constraints).toEqual([]);
  });
});
