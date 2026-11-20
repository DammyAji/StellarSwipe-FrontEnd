import type { EquityPoint } from "@/lib/backtest";

export interface DrawdownPoint {
  index: number;
  time: string;
  equity: number;
}

export type DrawdownInterval =
  | {
      status: "ok";
      peak: DrawdownPoint;
      trough: DrawdownPoint;
      /** First point after the trough that regained the peak value; null if never recovered. */
      recovery: DrawdownPoint | null;
      /** Peak-to-trough decline as a fraction (0.2 = 20%). */
      depth: number;
      /** Disclosures about incomplete or inconsistent history. */
      notes: string[];
    }
  | { status: "none"; notes: string[] }
  | { status: "unavailable"; reason: string };

const MIN_POINTS = 2;
const COARSE_POINTS = 10;
/** Allowed difference (fraction) between the computed and reported drawdown before it is disclosed. */
const REPORTED_TOLERANCE = 0.005;

/**
 * Finds the worst peak-to-trough drawdown on an equity curve and where (if ever)
 * it recovered. Returns "unavailable" instead of guessing when the curve is
 * missing, unordered or invalid, and discloses a curve too coarse to trust.
 */
export function findMaxDrawdownInterval(
  curve: readonly EquityPoint[] | undefined,
  reportedMaxDrawdown?: number
): DrawdownInterval {
  if (!curve || curve.length === 0) {
    return { status: "unavailable", reason: "No equity curve was recorded for this run, so the drawdown interval cannot be located." };
  }
  if (curve.length < MIN_POINTS) {
    return { status: "unavailable", reason: "The equity curve has fewer than two points, which is not enough to find a drawdown." };
  }
  if (curve.some((p) => !Number.isFinite(p.equity) || p.equity <= 0)) {
    return { status: "unavailable", reason: "The equity curve contains missing or non-positive values, so the drawdown was not calculated." };
  }
  const times = curve.map((p) => Date.parse(p.time));
  if (times.some(Number.isNaN)) {
    return { status: "unavailable", reason: "The equity curve contains invalid timestamps, so the drawdown was not calculated." };
  }
  if (times.some((t, i) => i > 0 && t < times[i - 1])) {
    return { status: "unavailable", reason: "The equity curve is not in chronological order, so the drawdown was not calculated." };
  }

  let peakIndex = 0;
  let worst = { depth: 0, peak: 0, trough: 0 };
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].equity > curve[peakIndex].equity) peakIndex = i;
    const depth = (curve[peakIndex].equity - curve[i].equity) / curve[peakIndex].equity;
    if (depth > worst.depth) worst = { depth, peak: peakIndex, trough: i };
  }

  const notes: string[] = [];
  if (curve.length < COARSE_POINTS) {
    notes.push(`Only ${curve.length} equity points were recorded; the true trough may fall between them.`);
  }
  if (worst.depth === 0) {
    return { status: "none", notes: [...notes, "The recorded equity never fell below an earlier high."] };
  }

  const point = (index: number): DrawdownPoint => ({ index, time: curve[index].time, equity: curve[index].equity });
  const peak = point(worst.peak);
  const trough = point(worst.trough);
  let recovery: DrawdownPoint | null = null;
  for (let i = worst.trough + 1; i < curve.length; i++) {
    if (curve[i].equity >= peak.equity) {
      recovery = point(i);
      break;
    }
  }
  if (!recovery) notes.push("The equity had not regained its earlier high by the end of the recorded period.");
  if (typeof reportedMaxDrawdown === "number" && Math.abs(reportedMaxDrawdown - worst.depth) > REPORTED_TOLERANCE) {
    notes.push(
      `The curve gives a ${(worst.depth * 100).toFixed(2)}% drawdown, which differs from the reported ${(reportedMaxDrawdown * 100).toFixed(2)}%; the curve may be incomplete.`
    );
  }
  return { status: "ok", peak, trough, recovery, depth: worst.depth, notes };
}
