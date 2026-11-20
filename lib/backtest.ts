export type BacktestParams = {
  from: string;
  to: string;
  signals: string[];
  slippageBps?: number;
  feeBps?: number;
  /** Starting capital of the simulation, when the run recorded one. */
  startingCapital?: number;
  /** Asset the run traded, when the run recorded one. */
  asset?: string;
};

export type EquityPoint = { time: string; equity: number };
export type PricePoint = { time: string; price: number };

export type BacktestResult = {
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  trades: Array<{ time: string; pnl: number }>;
  /** Equity over time, oldest first, when the simulation recorded it. */
  equityCurve?: EquityPoint[];
  /** Price history of the traded asset for the period, when available. */
  priceHistory?: PricePoint[];
};

export async function runBacktest(
  params: BacktestParams
): Promise<BacktestResult> {
  // Placeholder: implement historical price fetching and simulation engine
  await new Promise((r) => setTimeout(r, 500));
  return {
    totalReturn: 0,
    winRate: 0,
    maxDrawdown: 0,
    trades: [],
  };
}
