import { buildConfigSnapshot } from "@/lib/backtestSnapshot";
import type { BacktestParams } from "@/lib/backtest";

const full: BacktestParams = { from: "2023-01-01", to: "2023-12-31", signals: ["providerA", "signalX"], feeBps: 10, slippageBps: 5 };

describe("buildConfigSnapshot", () => {
  it("lists every captured input and is complete", () => {
    const snap = buildConfigSnapshot({ id: "run-1", timestamp: 1700000000000, params: full });
    expect(snap.partial).toBe(false);
    expect(snap.missing).toEqual([]);
    expect(snap.rows.map((r) => [r.key, r.value])).toEqual([
      ["from", "2023-01-01"],
      ["to", "2023-12-31"],
      ["signals", "providerA, signalX"],
      ["feeBps", "10"],
      ["slippageBps", "5"],
    ]);
  });

  it("marks older incomplete runs partial and never fills in defaults", () => {
    const snap = buildConfigSnapshot({ id: "run-old", timestamp: 1, params: { from: "2022-01-01", to: "2022-06-01", signals: [] } });
    expect(snap.partial).toBe(true);
    expect(snap.missing).toEqual(["Fee (bps)", "Slippage (bps)"]);
    expect(snap.rows.find((r) => r.key === "feeBps")).toMatchObject({ value: "Not captured", captured: false });
    expect(snap.rows.find((r) => r.key === "signals")?.value).toBe("None selected");
  });

  it("shows optional inputs only when the run recorded them", () => {
    const withExtras = buildConfigSnapshot({ id: "r", timestamp: 1, params: { ...full, startingCapital: 5000, asset: "XLM" } });
    expect(withExtras.rows.map((r) => r.key)).toEqual(expect.arrayContaining(["startingCapital", "asset"]));
    const without = buildConfigSnapshot({ id: "r", timestamp: 1, params: full });
    expect(without.rows.some((r) => r.key === "asset")).toBe(false);
  });

  it("handles a run with no saved params at all", () => {
    const snap = buildConfigSnapshot({ id: "r", timestamp: 1, params: undefined });
    expect(snap.partial).toBe(true);
    expect(snap.missing).toHaveLength(5);
  });

  it("is immutable and independent of later changes to the source", () => {
    const params = { ...full, signals: ["providerA"] };
    const snap = buildConfigSnapshot({ id: "r", timestamp: 1, params });
    params.signals.push("signalY");
    params.feeBps = 99;
    expect(snap.rows.find((r) => r.key === "signals")?.value).toBe("providerA");
    expect(snap.rows.find((r) => r.key === "feeBps")?.value).toBe("10");
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.rows)).toBe(true);
    expect(Object.isFrozen(snap.rows[0])).toBe(true);
  });
});
