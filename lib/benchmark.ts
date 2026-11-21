import type { PricePoint } from "@/hooks/usePriceHistory";

export interface PortfolioValuePoint {
  timestamp: number;
  value: number;
}

export interface BenchmarkSeries {
  portfolio: PortfolioValuePoint[];
  benchmark: PortfolioValuePoint[];
}

export function computeBenchmarkSeries(
  portfolioHistory: PortfolioValuePoint[],
  xlmHistory: PricePoint[],
  initialPortfolioValue: number
): BenchmarkSeries {
  if (portfolioHistory.length === 0 || xlmHistory.length === 0) {
    return { portfolio: [], benchmark: [] };
  }

  const sortedPortfolio = [...portfolioHistory].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const sortedXLM = [...xlmHistory].sort((a, b) => a.timestamp - b.timestamp);

  const benchmarkValues = sortedXLM.map((point) => {
    const startPrice = sortedXLM[0].price;
    const priceRatio = point.price / startPrice;
    return {
      timestamp: point.timestamp,
      value: parseFloat((initialPortfolioValue * priceRatio).toFixed(2)),
    };
  });

  return {
    portfolio: sortedPortfolio,
    benchmark: benchmarkValues,
  };
}

export interface IntervalGap {
  /** Timestamp of the last point before the gap. */
  from: number;
  /** Timestamp of the first point after the gap. */
  to: number;
  /** Number of expected intervals that have no data. */
  missingIntervals: number;
}

export interface IntervalGapReport {
  /** Expected spacing between consecutive points, in ms. */
  expectedIntervalMs: number;
  gaps: IntervalGap[];
  /** Total number of expected intervals with no data. */
  missingIntervals: number;
}

/**
 * Detects intervals with no data in a time series so charts can explain them
 * instead of drawing a straight line through the hole as if it were real
 * performance. A gap is only reported when at least one whole expected
 * interval is missing (a 1.5x spacing is treated as a single missing slot).
 */
export function detectIntervalGaps(
  points: { timestamp: number }[],
  expectedIntervalMs: number
): IntervalGapReport {
  const empty: IntervalGapReport = {
    expectedIntervalMs,
    gaps: [],
    missingIntervals: 0,
  };
  if (!Number.isFinite(expectedIntervalMs) || expectedIntervalMs <= 0) {
    return empty;
  }
  if (points.length < 2) return empty;

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const gaps: IntervalGap[] = [];
  let missingIntervals = 0;

  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].timestamp - sorted[i - 1].timestamp;
    const missing = Math.round(delta / expectedIntervalMs) - 1;
    if (missing > 0) {
      gaps.push({
        from: sorted[i - 1].timestamp,
        to: sorted[i].timestamp,
        missingIntervals: missing,
      });
      missingIntervals += missing;
    }
  }

  return { expectedIntervalMs, gaps, missingIntervals };
}

export function generateMockPortfolioHistory(
  initialValue: number,
  points: number,
  intervalMs: number
): PortfolioValuePoint[] {
  const history: PortfolioValuePoint[] = [];
  let value = initialValue;
  const now = Date.now();

  history.push({
    timestamp: now - (points - 1) * intervalMs,
    value: initialValue,
  });

  for (let i = 1; i < points; i++) {
    const delta = (Math.random() - 0.48) * 0.15;
    value = Math.max(0, value + delta * value);
    history.push({
      timestamp: now - (points - 1 - i) * intervalMs,
      value: parseFloat(value.toFixed(2)),
    });
  }

  return history;
}

export function computePerformanceDelta(
  portfolioHistory: PortfolioValuePoint[],
  xlmHistory: PricePoint[]
): {
  portfolioReturn: number;
  benchmarkReturn: number;
  outperformance: number;
} | null {
  if (portfolioHistory.length === 0 || xlmHistory.length === 0) {
    return null;
  }

  const sortedPortfolio = [...portfolioHistory].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const sortedXLM = [...xlmHistory].sort((a, b) => a.timestamp - b.timestamp);

  const startPortfolio = sortedPortfolio[0].value;
  const endPortfolio = sortedPortfolio[sortedPortfolio.length - 1].value;
  const startXLM = sortedXLM[0].price;
  const endXLM = sortedXLM[sortedXLM.length - 1].price;

  const portfolioReturn =
    ((endPortfolio - startPortfolio) / startPortfolio) * 100;
  const benchmarkReturn = ((endXLM - startXLM) / startXLM) * 100;

  return {
    portfolioReturn: parseFloat(portfolioReturn.toFixed(2)),
    benchmarkReturn: parseFloat(benchmarkReturn.toFixed(2)),
    outperformance: parseFloat((portfolioReturn - benchmarkReturn).toFixed(2)),
  };
}
