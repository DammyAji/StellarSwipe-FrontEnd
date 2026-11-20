import type { PortfolioValuePoint } from "@/lib/benchmark";

/**
 * Represents a single daily portfolio movement.
 */
export interface DailyMovement {
  /** Start of the day (local time), epoch ms. */
  day: number;
  /** Portfolio value at the end of the day. */
  value: number;
  /** Change from previous day's value. */
  change: number;
  /** Percentage change from previous day. */
  changePercent: number;
}

/**
 * Calculate daily portfolio movements from a history of portfolio values.
 *
 * Groups points by calendar day (using local time), takes the last point of each day
 * as the day's closing value, then computes day-over-day changes.
 *
 * Missing days are NOT included (not ranked as zero) — only days with actual data
 * are considered. This prevents gaps in history from creating artificial extremes.
 *
 * @param history - Array of portfolio value points, sorted by timestamp ascending
 * @returns Array of daily movements, sorted by day ascending (oldest first)
 */
export function calculateDailyMovements(
  history: PortfolioValuePoint[]
): DailyMovement[] {
  if (history.length < 2) return [];

  // Group by day, keeping the last point of each day as the closing value
  const byDay = new Map<number, PortfolioValuePoint>();

  for (const point of history) {
    const day = toDayKey(point.timestamp);
    const existing = byDay.get(day);
    if (!existing || point.timestamp > existing.timestamp) {
      byDay.set(day, point);
    }
  }

  // Sort days chronologically
  const sortedDays = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]);

  // Need at least 2 days with data to calculate a change
  if (sortedDays.length < 2) return [];

  const movements: DailyMovement[] = [];

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = sortedDays[i - 1];
    const currDay = sortedDays[i];

    const prevValue = prevDay[1].value;
    const currValue = currDay[1].value;
    const change = currValue - prevValue;
    const changePercent = prevValue !== 0 ? (change / Math.abs(prevValue)) * 100 : 0;

    movements.push({
      day: currDay[0],
      value: currValue,
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
    });
  }

  return movements;
}

/**
 * Find the largest daily gain and largest daily loss from daily movements.
 *
 * @param movements - Array of daily movements (from calculateDailyMovements)
 * @returns Object with largestGain and largestLoss, or null if insufficient data
 */
export function findLargestDailyMovements(
  movements: DailyMovement[]
): {
  largestGain: DailyMovement | null;
  largestLoss: DailyMovement | null;
} {
  if (movements.length === 0) {
    return { largestGain: null, largestLoss: null };
  }

  let largestGain: DailyMovement | null = null;
  let largestLoss: DailyMovement | null = null;

  for (const m of movements) {
    if (m.change > 0) {
      if (!largestGain || m.change > largestGain.change) {
        largestGain = m;
      }
    } else if (m.change < 0) {
      if (!largestLoss || m.change < largestLoss.change) {
        largestLoss = m;
      }
    }
  }

  return { largestGain, largestLoss };
}

/**
 * Check if there is sufficient history to calculate meaningful daily movements.
 * Requires at least 2 days with data.
 */
export function hasSufficientHistoryForDailyMovements(
  history: PortfolioValuePoint[]
): boolean {
  const movements = calculateDailyMovements(history);
  return movements.length > 0;
}

/**
 * Normalize a timestamp to the start of its calendar day (local time).
 */
function toDayKey(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}