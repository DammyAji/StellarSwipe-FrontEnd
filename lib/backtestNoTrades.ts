import type { BacktestParams, BacktestResult } from "@/lib/backtest";

export interface NoTradesConstraint {
  id: string;
  /** What the run's saved inputs show. Worded as a fact or a possibility, never as a proven cause. */
  message: string;
  /** DOM id of the simulator input this relates to (see BacktestTool). */
  inputId: string;
  inputLabel: string;
}

export interface NoTradesExplanation {
  /** False when the run produced trades, so no explanation is needed. */
  applicable: boolean;
  constraints: NoTradesConstraint[];
  /** Always shown: what the saved data cannot tell. */
  unknownNote: string;
}

/** Combined fee + slippage (bps) above which the costs are called out as unusually high. */
export const HIGH_COST_BPS = 100;
/** Periods shorter than this many days are called out. */
export const SHORT_PERIOD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const NO_TRADES_UNKNOWN_NOTE =
  "Other reasons, such as the selected signals not producing a signal in this period or missing market data, cannot be determined from this run's saved data.";

/** Whole days covered by an inclusive date range, or null when the dates are invalid. */
export function periodDays(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / DAY_MS) + 1;
}

/**
 * Explains a completed run with no trades using only facts that the saved inputs
 * establish. Anything the data cannot show is left to `unknownNote`.
 */
export function explainNoTrades(
  params: Partial<BacktestParams> | undefined,
  result: Pick<BacktestResult, "trades"> | undefined
): NoTradesExplanation {
  const trades = result?.trades;
  const applicable = Array.isArray(trades) && trades.length === 0;
  const constraints: NoTradesConstraint[] = [];
  if (!applicable || !params) return { applicable, constraints, unknownNote: NO_TRADES_UNKNOWN_NOTE };

  if (Array.isArray(params.signals) && params.signals.length === 0) {
    constraints.push({
      id: "no-signals",
      message: "No signals or providers were selected, so the simulation had no signal source to trade on.",
      inputId: "backtest-signals",
      inputLabel: "Providers / Signals",
    });
  }

  if (params.from && params.to) {
    const days = periodDays(params.from, params.to);
    if (days !== null && days < 1) {
      constraints.push({
        id: "invalid-period",
        message: "The start date is after the end date, so the period contains no days.",
        inputId: "backtest-from",
        inputLabel: "From / To dates",
      });
    } else if (days !== null && days < SHORT_PERIOD_DAYS) {
      constraints.push({
        id: "short-period",
        message: `The period is only ${days} day${days === 1 ? "" : "s"} long, which leaves little time for a signal to occur.`,
        inputId: "backtest-from",
        inputLabel: "From / To dates",
      });
    }
  }

  const costs = (params.feeBps ?? 0) + (params.slippageBps ?? 0);
  if (costs >= HIGH_COST_BPS) {
    constraints.push({
      id: "high-costs",
      message: `Fee and slippage together are ${costs} bps per trade. That is worth checking, but this run's data cannot show whether it affected trading.`,
      inputId: "backtest-fee",
      inputLabel: "Fee and slippage",
    });
  }

  return { applicable, constraints, unknownNote: NO_TRADES_UNKNOWN_NOTE };
}
