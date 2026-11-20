import type { BacktestParams } from "@/lib/backtest";

/** Starting values of the simulator form; the form reads them from here too. */
export const DEFAULT_BACKTEST_PARAMS: Required<Pick<BacktestParams, "from" | "to" | "signals" | "slippageBps" | "feeBps">> = {
  from: "2023-01-01",
  to: "2023-12-31",
  signals: [],
  slippageBps: 10,
  feeBps: 10,
};

export interface FailedBacktestRun {
  id: string;
  params: BacktestParams;
  error: string;
  timestamp: number;
}

export interface RetryEligibility {
  eligible: boolean;
  /** Why a run cannot be retried; null when it can. */
  reason: string | null;
}

/** A failed run can be retried when its saved inputs are still a valid simulation request. */
export function retryEligibility(run: Pick<FailedBacktestRun, "params"> | undefined): RetryEligibility {
  const p = run?.params;
  if (!p || !p.from || !p.to) return { eligible: false, reason: "The saved inputs are incomplete (missing dates)." };
  if (Number.isNaN(Date.parse(p.from)) || Number.isNaN(Date.parse(p.to))) {
    return { eligible: false, reason: "The saved dates are not valid." };
  }
  if (p.from > p.to) return { eligible: false, reason: "The saved start date is after the end date." };
  if (!Array.isArray(p.signals)) return { eligible: false, reason: "The saved signal selection is missing." };
  return { eligible: true, reason: null };
}

export interface ParamDifference {
  field: string;
  label: string;
  saved: string;
  current: string;
}

function show(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  return value === undefined || value === null || value === "" ? "none" : String(value);
}

/** Inputs of a saved run that differ from what a fresh simulator form starts with. */
export function diffAgainstDefaults(
  params: BacktestParams,
  defaults: typeof DEFAULT_BACKTEST_PARAMS = DEFAULT_BACKTEST_PARAMS
): ParamDifference[] {
  const labels: Array<[keyof typeof DEFAULT_BACKTEST_PARAMS, string]> = [
    ["from", "Start date"],
    ["to", "End date"],
    ["signals", "Signals"],
    ["feeBps", "Fee (bps)"],
    ["slippageBps", "Slippage (bps)"],
  ];
  const out: ParamDifference[] = [];
  for (const [field, label] of labels) {
    const saved = params[field];
    const current = defaults[field];
    const same = Array.isArray(current)
      ? Array.isArray(saved) && saved.length === current.length && saved.every((v, i) => v === current[i])
      : saved === current;
    if (!same) out.push({ field, label, saved: show(saved), current: show(current) });
  }
  return out;
}
