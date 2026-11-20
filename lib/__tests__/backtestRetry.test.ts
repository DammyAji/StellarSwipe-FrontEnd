import { DEFAULT_BACKTEST_PARAMS, diffAgainstDefaults, retryEligibility } from "@/lib/backtestRetry";
import type { BacktestParams } from "@/lib/backtest";

const params: BacktestParams = { from: "2023-01-01", to: "2023-12-31", signals: [], feeBps: 10, slippageBps: 10 };

describe("retryEligibility", () => {
  it("accepts a failed run with valid saved inputs", () => {
    expect(retryEligibility({ params })).toEqual({ eligible: true, reason: null });
  });

  it("rejects incomplete, invalid or inverted inputs with a reason", () => {
    expect(retryEligibility(undefined).eligible).toBe(false);
    expect(retryEligibility({ params: { ...params, from: "" } }).reason).toMatch(/incomplete/i);
    expect(retryEligibility({ params: { ...params, from: "nope" } }).reason).toMatch(/not valid/i);
    expect(retryEligibility({ params: { ...params, from: "2024-01-01", to: "2023-01-01" } }).reason).toMatch(/after the end date/i);
    expect(retryEligibility({ params: { ...params, signals: undefined as unknown as string[] } }).reason).toMatch(/signal/i);
  });
});

describe("diffAgainstDefaults", () => {
  it("reports nothing when the saved inputs match the defaults", () => {
    expect(diffAgainstDefaults({ ...DEFAULT_BACKTEST_PARAMS })).toEqual([]);
  });

  it("lists each differing input with the saved and default values", () => {
    const diffs = diffAgainstDefaults({ ...DEFAULT_BACKTEST_PARAMS, from: "2022-05-01", signals: ["providerA", "signalX"], feeBps: 25 });
    expect(diffs).toEqual([
      { field: "from", label: "Start date", saved: "2022-05-01", current: "2023-01-01" },
      { field: "signals", label: "Signals", saved: "providerA, signalX", current: "none" },
      { field: "feeBps", label: "Fee (bps)", saved: "25", current: "10" },
    ]);
  });

  it("treats a missing fee or slippage as different from the default", () => {
    const diffs = diffAgainstDefaults({ ...DEFAULT_BACKTEST_PARAMS, feeBps: undefined });
    expect(diffs).toEqual([{ field: "feeBps", label: "Fee (bps)", saved: "none", current: "10" }]);
  });
});
