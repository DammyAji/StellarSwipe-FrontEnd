/**
 * Period-over-period comparison calculation utilities.
 *
 * Handles comparison metrics (current vs prior period) with support for:
 * - Multiple granularities (week, month, quarter, year)
 * - Partial/incomplete period detection and handling
 * - Zero/null value edge cases
 * - Pro-rating for incomplete periods
 */

export type ComparisonGranularity = "week" | "month" | "quarter" | "year";

export interface ComparisonMetrics {
  currentValue: number;
  priorValue: number;
  absoluteChange: number;
  percentageChange: number;
  isPositive: boolean;
  isNeutral: boolean;
}

export interface PeriodDateRange {
  start: Date;
  end: Date;
}

export interface PeriodComparisonData {
  currentPeriod: {
    range: PeriodDateRange;
    isComplete: boolean;
    completenessPercent: number;
  };
  priorPeriod: {
    range: PeriodDateRange;
    isComplete: boolean;
  };
  metrics: ComparisonMetrics;
  metadata: {
    calculatedAt: Date;
    hasNoPriorData: boolean;
  };
}

/**
 * Calculate the percentage change between two values.
 * Returns 0 if prior value is 0 or null to avoid division by zero.
 *
 * Formula: ((current - prior) / prior) * 100
 */
export function calculatePercentageChange(
  current: number,
  prior: number | null | undefined
): number {
  if (!prior || prior === 0) return 0;
  const change = ((current - prior) / Math.abs(prior)) * 100;
  return parseFloat(change.toFixed(2));
}

/**
 * Calculate the absolute change between two values.
 * Handles null/undefined prior values.
 */
export function calculateAbsoluteChange(
  current: number,
  prior: number | null | undefined
): number {
  if (prior == null) return current;
  const change = current - prior;
  return parseFloat(change.toFixed(2));
}

/**
 * Create comparison metrics from current and prior values.
 */
export function createComparisonMetrics(
  currentValue: number,
  priorValue: number | null | undefined
): ComparisonMetrics {
  const absoluteChange = calculateAbsoluteChange(currentValue, priorValue);
  const percentageChange = calculatePercentageChange(currentValue, priorValue);

  return {
    currentValue: parseFloat(currentValue.toFixed(2)),
    priorValue: priorValue ? parseFloat(priorValue.toFixed(2)) : 0,
    absoluteChange,
    percentageChange,
    isPositive: absoluteChange > 0,
    isNeutral: absoluteChange === 0,
  };
}

/**
 * Get the date range for a given period.
 * End date is exclusive (start of next period).
 */
export function getPeriodDateRange(
  endDate: Date,
  granularity: ComparisonGranularity
): PeriodDateRange {
  const end = new Date(endDate);
  const start = new Date(endDate);

  switch (granularity) {
    case "week":
      // Get start of the current week (Monday)
      const day = end.getDay();
      const diff = end.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "quarter":
      const quarter = Math.floor(end.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Get the date range for the prior period relative to a given period.
 */
export function getPriorPeriodDateRange(
  currentStart: Date,
  granularity: ComparisonGranularity
): PeriodDateRange {
  const priorEnd = new Date(currentStart);
  priorEnd.setMilliseconds(-1); // Go back 1ms to get the end of previous period

  return getPeriodDateRange(priorEnd, granularity);
}

/**
 * Detect if a period is complete based on the end date.
 * A period is incomplete if it hasn't ended yet.
 */
export function isCompletePeriod(
  periodEnd: Date,
  now: Date = new Date()
): boolean {
  return periodEnd <= now;
}

/**
 * Calculate the completeness percentage of a period.
 * Returns 100 for complete periods, 0-99 for incomplete periods.
 */
export function calculateCompletenessPercent(
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): number {
  if (now >= periodEnd) return 100;
  if (now < periodStart) return 0;

  const totalDuration = periodEnd.getTime() - periodStart.getTime();
  const elapsedDuration = now.getTime() - periodStart.getTime();
  const percent = (elapsedDuration / totalDuration) * 100;

  return Math.round(percent);
}

/**
 * Pro-rate a metric to full period completion.
 * Useful for annualizing partial period metrics.
 *
 * @param value - The partial period value
 * @param completenessPercent - Percentage of period completed (0-100)
 * @returns The pro-rated full period value
 */
export function prorateToFullPeriod(
  value: number,
  completenessPercent: number
): number {
  if (completenessPercent === 0 || completenessPercent === 100) return value;
  const prorated = (value / completenessPercent) * 100;
  return parseFloat(prorated.toFixed(2));
}

/**
 * Create a complete period comparison data object.
 * Handles partial period detection and pro-rating.
 *
 * @param currentValue - Current period metric value
 * @param priorValue - Prior period metric value (null if no data)
 * @param granularity - Comparison granularity
 * @param now - Current date/time (defaults to now)
 * @param shouldProratePartial - Whether to pro-rate incomplete periods (defaults to false)
 */
export function createPeriodComparison(
  currentValue: number,
  priorValue: number | null | undefined,
  granularity: ComparisonGranularity,
  now: Date = new Date(),
  shouldProratePartial: boolean = false
): PeriodComparisonData {
  const currentPeriodRange = getPeriodDateRange(now, granularity);
  const priorPeriodRange = getPriorPeriodDateRange(currentPeriodRange.start, granularity);

  const currentIsComplete = isCompletePeriod(currentPeriodRange.end, now);
  const currentCompletenessPercent = calculateCompletenessPercent(
    currentPeriodRange.start,
    currentPeriodRange.end,
    now
  );

  // If current period is incomplete and pro-rating is enabled, pro-rate the current value
  const adjustedCurrentValue =
    shouldProratePartial && !currentIsComplete
      ? prorateToFullPeriod(currentValue, currentCompletenessPercent)
      : currentValue;

  const metrics = createComparisonMetrics(adjustedCurrentValue, priorValue);

  return {
    currentPeriod: {
      range: currentPeriodRange,
      isComplete: currentIsComplete,
      completenessPercent: currentCompletenessPercent,
    },
    priorPeriod: {
      range: priorPeriodRange,
      isComplete: true, // Prior periods are always complete
    },
    metrics,
    metadata: {
      calculatedAt: now,
      hasNoPriorData: !priorValue,
    },
  };
}

/**
 * Format a ComparisonGranularity to a human-readable label.
 */
export function formatGranularityLabel(granularity: ComparisonGranularity): string {
  const labels: Record<ComparisonGranularity, string> = {
    week: "Week-over-Week",
    month: "Month-over-Month",
    quarter: "Quarter-over-Quarter",
    year: "Year-over-Year",
  };
  return labels[granularity];
}

/**
 * Format a date range to a human-readable string.
 * e.g., "Jun 24 - Jun 30" or "Jun 1 - Jun 30"
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleString("en-US", { month: "short" });
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

// ---------------------------------------------------------------------------
// Multi-wallet performance comparison
// ---------------------------------------------------------------------------

/**
 * A single point in a wallet's performance history.
 * `value` is the performance value at `date`; points with no data must be
 * omitted from the history rather than recorded as zero.
 */
export interface WalletHistoryPoint {
  date: Date;
  value: number;
}

/**
 * Input describing one connected wallet's performance history.
 */
export interface WalletHistoryInput {
  /** Stable identifier for the wallet (e.g. address). */
  walletId: string;
  /** Human-readable legend label. Falls back to a shortened walletId. */
  label?: string;
  /** Performance history points. Missing dates are simply absent. */
  history: WalletHistoryPoint[];
}

/**
 * A labeled, scaled series ready for plotting.
 * `points` only contains dates where the wallet actually has data.
 */
export interface WalletComparisonSeries {
  walletId: string;
  label: string;
  points: WalletHistoryPoint[];
  /** True when the wallet has no points within the shared range. */
  isEmpty: boolean;
}

/**
 * Result of building a multi-wallet comparison.
 */
export interface MultiWalletComparison {
  /** Shared date range across all wallets (null when no data exists). */
  range: PeriodDateRange | null;
  /** Shared y-axis scale across all wallets (null when no data exists). */
  scale: { min: number; max: number } | null;
  /** Labeled series, one per input wallet, in input order. */
  series: WalletComparisonSeries[];
  /** True when no wallet has any usable data in the shared range. */
  isEmpty: boolean;
}

function toDayKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function defaultWalletLabel(walletId: string): string {
  if (walletId.length <= 10) return walletId;
  return `${walletId.slice(0, 6)}…${walletId.slice(-4)}`;
}

/**
 * Build a multi-wallet comparison over a shared date range and scale.
 *
 * - The shared range is the intersection of all wallets' data ranges so that
 *   every series is plotted over the same period.
 * - Points outside the shared range are dropped.
 * - Missing history is never zero-filled: absent dates are simply omitted.
 * - The scale is computed from the actual plotted points across all wallets.
 *
 * @param wallets - Connected wallet histories to compare
 * @param range - Optional explicit range to constrain the comparison to
 */
export function buildMultiWalletComparison(
  wallets: WalletHistoryInput[],
  range?: PeriodDateRange
): MultiWalletComparison {
  const normalized = wallets.map((wallet) => {
    const byDay = new Map<string, WalletHistoryPoint>();
    for (const point of wallet.history) {
      if (!Number.isFinite(point.value)) continue;
      const key = toDayKey(point.date);
      // Keep the last valid point per day.
      byDay.set(key, { date: new Date(point.date), value: point.value });
    }
    const points = Array.from(byDay.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    return {
      walletId: wallet.walletId,
      label: wallet.label?.trim() || defaultWalletLabel(wallet.walletId),
      points,
    };
  });

  // Determine the shared range: intersection of per-wallet ranges, optionally
  // constrained by an explicit range.
  let sharedStart: Date | null = null;
  let sharedEnd: Date | null = null;

  for (const wallet of normalized) {
    if (wallet.points.length === 0) continue;
    const first = wallet.points[0].date;
    const last = wallet.points[wallet.points.length - 1].date;
    if (sharedStart === null || first.getTime() > sharedStart.getTime()) {
      sharedStart = first;
    }
    if (sharedEnd === null || last.getTime() < sharedEnd.getTime()) {
      sharedEnd = last;
    }
  }

  if (range) {
    if (sharedStart === null || range.start.getTime() > sharedStart.getTime()) {
      sharedStart = new Date(range.start);
    }
    if (sharedEnd === null || range.end.getTime() < sharedEnd.getTime()) {
      sharedEnd = new Date(range.end);
    }
  }

  const hasRange =
    sharedStart !== null && sharedEnd !== null && sharedStart.getTime() <= sharedEnd.getTime();

  const series: WalletComparisonSeries[] = normalized.map((wallet) => {
    const points = hasRange
      ? wallet.points.filter(
          (p) =>
            p.date.getTime() >= (sharedStart as Date).getTime() &&
            p.date.getTime() <= (sharedEnd as Date).getTime()
        )
      : [];
    return {
      walletId: wallet.walletId,
      label: wallet.label,
      points,
      isEmpty: points.length === 0,
    };
  });

  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    }
  }

  const hasData = min !== Infinity && max !== -Infinity;

  return {
    range: hasRange ? { start: sharedStart as Date, end: sharedEnd as Date } : null,
    scale: hasData ? { min, max } : null,
    series,
    isEmpty: !hasData,
  };
}

// ---------------------------------------------------------------------------
// Fee-adjusted benchmark comparison
// ---------------------------------------------------------------------------

/**
 * Fee inputs required to compute a fee-adjusted (net) return.
 * Any missing input means the adjusted value cannot be computed.
 */
export interface FeeInputs {
  /** Gross return for the period, as a percentage (e.g. 12.5 for 12.5%). */
  grossReturnPercent: number;
  /** Management/performance fee for the period, as a percentage. */
  managementFeePercent?: number | null;
  /** Trading/transaction fees for the period, as a percentage. */
  tradingFeePercent?: number | null;
  /** Other fees for the period, as a percentage. */
  otherFeePercent?: number | null;
}

/**
 * Fee-adjusted comparison result.
 * Gross and adjusted values are kept distinct, and incomplete fee data is
 * disclosed via `isComplete` / `missingInputs`.
 */
export interface FeeAdjustedComparison {
  /** Gross return, always available. */
  grossReturnPercent: number;
  /** Net (fee-adjusted) return, or null when fee data is incomplete. */
  adjustedReturnPercent: number | null;
  /** Total fees applied, or null when fee data is incomplete. */
  totalFeePercent: number | null;
  /** True when all required fee inputs were provided. */
  isComplete: boolean;
  /** Names of fee inputs that were missing. */
  missingInputs: string[];
  /** Human-readable assumptions describing how the adjusted value was derived. */
  assumptions: string[];
}

/**
 * Compute gross vs fee-adjusted returns from available fee inputs.
 *
 * Adjusted return is only produced when all fee inputs are available; when
 * data is incomplete the adjusted value is null and the missing inputs are
 * disclosed rather than assumed to be zero.
 */
export function computeFeeAdjustedComparison(inputs: FeeInputs): FeeAdjustedComparison {
  const feeFields: Array<{ key: keyof FeeInputs; label: string }> = [
    { key: "managementFeePercent", label: "managementFeePercent" },
    { key: "tradingFeePercent", label: "tradingFeePercent" },
    { key: "otherFeePercent", label: "otherFeePercent" },
  ];

  const missingInputs: string[] = [];
  let totalFeePercent = 0;

  for (const field of feeFields) {
    const value = inputs[field.key];
    if (value == null || !Number.isFinite(value)) {
      missingInputs.push(field.label);
    } else {
      totalFeePercent += value;
    }
  }

  const isComplete = missingInputs.length === 0;
  const grossReturnPercent = parseFloat(inputs.grossReturnPercent.toFixed(2));

  if (!isComplete) {
    return {
      grossReturnPercent,
      adjustedReturnPercent: null,
      totalFeePercent: null,
      isComplete: false,
      missingInputs,
      assumptions: [
        "Adjusted return unavailable: fee data is incomplete.",
        `Missing fee inputs: ${missingInputs.join(", ")}.`,
      ],
    };
  }

  const adjustedReturnPercent = parseFloat(
    (grossReturnPercent - totalFeePercent).toFixed(2)
  );

  return {
    grossReturnPercent,
    adjustedReturnPercent,
    totalFeePercent: parseFloat(totalFeePercent.toFixed(2)),
    isComplete: true,
    missingInputs: [],
    assumptions: [
      "Adjusted return = gross return − total fees.",
      "Fees are expressed as a percentage of invested value for the same period.",
    ],
  };
}

/**
 * Align a fee-adjusted comparison with a period comparison so both share the
 * same period boundaries.
 */
export function alignFeeAdjustedWithPeriod(
  feeAdjusted: FeeAdjustedComparison,
  period: PeriodComparisonData
): FeeAdjustedComparison & { period: PeriodComparisonData["currentPeriod"] } {
  return {
    ...feeAdjusted,
    period: period.currentPeriod,
  };
}
