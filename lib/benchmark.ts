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

export interface BenchmarkFeeInputs {
  /** Platform fee rate as a fraction (e.g. 0.01 for 1%). */
  platformFeeRate?: number | null;
  /** Flat network fee applied per rebalance, in the series' value units. */
  networkFee?: number | null;
  /** Share of gross returns retained by the provider, as a fraction. */
  providerShare?: number | null;
}

export interface BenchmarkFeeAssumptions {
  platformFeeRate: number | null;
  networkFee: number | null;
  providerShare: number | null;
  /** Human-readable notes describing how adjusted values were derived. */
  notes: string[];
}

export interface FeeAdjustedBenchmarkSeries {
  /** Unadjusted benchmark values, aligned to the comparison period. */
  gross: PortfolioValuePoint[];
  /**
   * Fee-adjusted benchmark values. Empty when no fee inputs are available,
   * so callers never present adjusted data as fact without inputs.
   */
  adjusted: PortfolioValuePoint[];
  /** Which fee inputs were actually supplied and usable. */
  availableInputs: {
    platformFeeRate: boolean;
    networkFee: boolean;
    providerShare: boolean;
  };
  /** True when at least one fee input is missing or invalid. */
  incomplete: boolean;
  assumptions: BenchmarkFeeAssumptions;
}

function normalizeRate(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Derives gross and fee-adjusted benchmark values from a benchmark series.
 *
 * Gross values are always returned (aligned to the comparison period). Adjusted
 * values are only produced when at least one valid fee input is supplied, and
 * the returned descriptor discloses which inputs were available so incomplete
 * fee data is never presented as fact.
 */
export function computeFeeAdjustedBenchmark(
  benchmark: PortfolioValuePoint[],
  fees: BenchmarkFeeInputs = {}
): FeeAdjustedBenchmarkSeries {
  const sorted = [...benchmark].sort((a, b) => a.timestamp - b.timestamp);
  const gross = sorted.map((point) => ({
    timestamp: point.timestamp,
    value: point.value,
  }));

  const platformFeeRate = normalizeRate(fees.platformFeeRate);
  const networkFee = normalizeRate(fees.networkFee);
  const providerShare = normalizeRate(fees.providerShare);

  const availableInputs = {
    platformFeeRate: platformFeeRate !== null,
    networkFee: networkFee !== null,
    providerShare: providerShare !== null,
  };
  const incomplete =
    !availableInputs.platformFeeRate ||
    !availableInputs.networkFee ||
    !availableInputs.providerShare;

  const notes: string[] = [];
  if (availableInputs.platformFeeRate) {
    notes.push(
      `Platform fee of ${(platformFeeRate! * 100).toFixed(2)}% applied to gross returns.`
    );
  } else {
    notes.push("Platform fee rate unavailable; not deducted.");
  }
  if (availableInputs.networkFee) {
    notes.push(`Network fee of ${networkFee} applied once per period.`);
  } else {
    notes.push("Network fee unavailable; not deducted.");
  }
  if (availableInputs.providerShare) {
    notes.push(
      `Provider share of ${(providerShare! * 100).toFixed(2)}% deducted from gross returns.`
    );
  } else {
    notes.push("Provider share unavailable; not deducted.");
  }

  const assumptions: BenchmarkFeeAssumptions = {
    platformFeeRate,
    networkFee,
    providerShare,
    notes,
  };

  const hasAnyInput =
    availableInputs.platformFeeRate ||
    availableInputs.networkFee ||
    availableInputs.providerShare;

  if (!hasAnyInput || gross.length === 0) {
    return { gross, adjusted: [], availableInputs, incomplete, assumptions };
  }

  const startValue = gross[0].value;
  const adjusted = gross.map((point) => {
    const grossReturn = point.value - startValue;
    let adjustedReturn = grossReturn;

    if (availableInputs.platformFeeRate) {
      adjustedReturn -= grossReturn * platformFeeRate!;
    }
    if (availableInputs.providerShare) {
      adjustedReturn -= grossReturn * providerShare!;
    }
    if (availableInputs.networkFee) {
      adjustedReturn -= networkFee!;
    }

    return {
      timestamp: point.timestamp,
      value: parseFloat((startValue + adjustedReturn).toFixed(2)),
    };
  });

  return { gross, adjusted, availableInputs, incomplete, assumptions };
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
