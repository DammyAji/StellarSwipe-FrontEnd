import type { BacktestParams, PricePoint } from "@/lib/backtest";

export interface BaselineAssumption {
  label: string;
  value: string;
}

export type BaselineResult =
  | {
      status: "ok";
      startTime: string;
      endTime: string;
      startPrice: number;
      endPrice: number;
      /** Return after the same fee and slippage assumptions as the strategy, as a fraction (0.1 = 10%). */
      totalReturn: number;
      /** Ending value of the starting capital; undefined when the capital was not recorded. */
      endingValue?: number;
      assumptions: BaselineAssumption[];
    }
  | { status: "unavailable"; reason: string; assumptions: BaselineAssumption[] };

function time(value: string): number {
  return Date.parse(value);
}

function describeAssumptions(params: BacktestParams): BaselineAssumption[] {
  return [
    { label: "Asset", value: params.asset?.trim() ? params.asset : "Not recorded for this run" },
    { label: "Period", value: `${params.from} to ${params.to}` },
    {
      label: "Starting capital",
      value:
        typeof params.startingCapital === "number" && params.startingCapital > 0
          ? String(params.startingCapital)
          : "Not recorded: baseline is shown as a percentage only",
    },
    { label: "Method", value: "Buy once at the first price in the period, hold, sell at the last price" },
    {
      label: "Costs",
      value: `Run's fee (${params.feeBps ?? 0} bps) and slippage (${params.slippageBps ?? 0} bps) on entry and on exit`,
    },
  ];
}

/**
 * Buy-and-hold result for the same period (and starting capital) as a run. It is
 * computed only from real price history that covers the whole period: gaps are
 * reported as unavailable instead of being estimated.
 */
export function computeBuyAndHoldBaseline(
  params: BacktestParams,
  priceHistory: readonly PricePoint[] | undefined
): BaselineResult {
  const assumptions = describeAssumptions(params);
  const unavailable = (reason: string): BaselineResult => ({ status: "unavailable", reason, assumptions });

  if (!priceHistory || priceHistory.length === 0) {
    return unavailable("No price history was recorded for this run, so a buy-and-hold baseline cannot be calculated.");
  }
  const from = time(params.from);
  const to = time(params.to);
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
    return unavailable("The run's date range is invalid, so no baseline period can be defined.");
  }
  const points = priceHistory
    .map((p) => ({ t: time(p.time), time: p.time, price: p.price }))
    .filter((p) => !Number.isNaN(p.t));
  if (points.length !== priceHistory.length) {
    return unavailable("Some price history timestamps are invalid, so the baseline was not calculated.");
  }
  if (points.some((p) => !Number.isFinite(p.price) || p.price <= 0)) {
    return unavailable("Price history contains missing or non-positive prices, so the baseline was not calculated.");
  }
  points.sort((a, b) => a.t - b.t);
  // The history must reach both ends of the period; interpolating would invent prices.
  const first = points[0];
  const last = points[points.length - 1];
  if (first.t > from || last.t < to) {
    return unavailable(
      `Price history covers ${first.time} to ${last.time}, which does not cover the run's period (${params.from} to ${params.to}).`
    );
  }
  const inPeriod = points.filter((p) => p.t >= from && p.t <= to);
  if (inPeriod.length < 2) {
    return unavailable("Fewer than two price points fall inside the run's period, so no baseline can be calculated.");
  }
  const start = inPeriod[0];
  const end = inPeriod[inPeriod.length - 1];
  const costFraction = ((params.feeBps ?? 0) + (params.slippageBps ?? 0)) / 10_000;
  const grossReturn = end.price / start.price;
  const net = (1 - costFraction) * grossReturn * (1 - costFraction);
  const totalReturn = net - 1;
  const capital = typeof params.startingCapital === "number" && params.startingCapital > 0 ? params.startingCapital : undefined;
  return {
    status: "ok",
    startTime: start.time,
    endTime: end.time,
    startPrice: start.price,
    endPrice: end.price,
    totalReturn,
    endingValue: capital !== undefined ? capital * net : undefined,
    assumptions,
  };
}

/** Strategy return minus baseline return, in percentage points. */
export function excessReturnPoints(strategyReturn: number, baselineReturn: number): number {
  return (strategyReturn - baselineReturn) * 100;
}
