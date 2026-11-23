import { useThemeStore, type ChartPalette } from "@/store/useThemeStore";

/**
 * Okabe–Ito palette — distinguishable under protanopia, deuteranopia and
 * tritanopia. Ordered so adjacent series differ in both hue and lightness.
 */
export const COLORBLIND_SAFE_COLORS = [
  "#0072B2", // blue
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
  "#999999", // grey
] as const;

/**
 * Non-color series differentiation for chart lines/areas.
 *
 * Each descriptor provides:
 * - `dashArray`  — SVG stroke-dasharray value (empty string = solid line).
 * - `patternId`  — ID referencing an SVG <pattern> element for filled areas
 *                  (e.g. donut segments, bar fills). Empty string = solid fill.
 * - `label`      — Human-readable description for legends and accessible summaries.
 *
 * The set is ordered so the first two entries are the primary/comparison pair
 * used by two-series charts, and subsequent entries cover multi-series charts.
 */
export interface SeriesPattern {
  /** SVG stroke-dasharray — empty string means a solid stroke. */
  dashArray: string;
  /**
   * ID for an SVG <pattern> element emitted by ChartPatternDefs.
   * Empty string means solid fill (no pattern overlay).
   */
  patternId: string;
  /** Screen-reader-friendly description, e.g. "solid line", "dashed line". */
  label: string;
}

export const SERIES_PATTERNS: SeriesPattern[] = [
  { dashArray: "",          patternId: "",           label: "solid line" },
  { dashArray: "6 3",       patternId: "pattern-dash", label: "dashed line" },
  { dashArray: "2 2",       patternId: "pattern-dot",  label: "dotted line" },
  { dashArray: "10 3 2 3",  patternId: "pattern-ddot", label: "dash-dot line" },
  { dashArray: "14 4",      patternId: "pattern-ldash", label: "long-dashed line" },
  { dashArray: "2 6",       patternId: "pattern-sparse", label: "sparse dotted line" },
  { dashArray: "8 3 2 3 2 3", patternId: "pattern-complex", label: "complex-dashed line" },
  { dashArray: "1 4",       patternId: "pattern-fine",  label: "fine dotted line" },
];

/** Return the pattern descriptor for series at `index`. */
export function getSeriesPattern(index: number): SeriesPattern {
  return SERIES_PATTERNS[index % SERIES_PATTERNS.length];
}

interface ChartColors {
  /** Primary series (e.g. portfolio value). */
  primary: string;
  /** Comparison series (e.g. benchmark). */
  secondary: string;
  /** Categorical color for the series at `index`, or `fallback` for the default palette. */
  series: (index: number, fallback: string) => string;
  /**
   * Non-color pattern descriptor for the series at `index`.
   * Always available regardless of palette — use alongside `series()` so
   * charts remain distinguishable without relying on color alone.
   */
  pattern: (index: number) => SeriesPattern;
}

const PALETTES: Record<ChartPalette, ChartColors> = {
  default: {
    primary: "#22c55e",
    secondary: "#60a5fa",
    series: (_index, fallback) => fallback,
    pattern: (index) => getSeriesPattern(index),
  },
  colorblind: {
    primary: COLORBLIND_SAFE_COLORS[0],
    secondary: COLORBLIND_SAFE_COLORS[1],
    series: (index) =>
      COLORBLIND_SAFE_COLORS[index % COLORBLIND_SAFE_COLORS.length],
    pattern: (index) => getSeriesPattern(index),
  },
};

export function getChartColors(palette: ChartPalette): ChartColors {
  return PALETTES[palette] ?? PALETTES.default;
}

/**
 * Intensity bucket for a single day in the calendar heatmap.
 *
 * `missing` is deliberately distinct from `zero`: a day with no data must
 * never be presented as a zero-return day.
 */
export type HeatmapBucket =
  | "missing"
  | "zero"
  | "gain-low"
  | "gain-mid"
  | "gain-high"
  | "loss-low"
  | "loss-mid"
  | "loss-high";

export interface HeatmapBucketStyle {
  /** Fill color for the day cell. */
  fill: string;
  /** SVG <pattern> id overlay (empty string = solid fill). */
  patternId: string;
  /** Screen-reader-friendly description of the bucket. */
  label: string;
}

/** Return thresholds (absolute daily return, as a fraction) for bucket edges. */
const HEATMAP_THRESHOLDS = {
  low: 0.005,
  mid: 0.02,
} as const;

const HEATMAP_BUCKETS: Record<HeatmapBucket, HeatmapBucketStyle> = {
  missing: {
    fill: "transparent",
    patternId: "pattern-heatmap-missing",
    label: "no data",
  },
  zero: {
    fill: "#e5e7eb",
    patternId: "",
    label: "no change",
  },
  "gain-low": {
    fill: "#bbf7d0",
    patternId: "",
    label: "small gain",
  },
  "gain-mid": {
    fill: "#4ade80",
    patternId: "",
    label: "moderate gain",
  },
  "gain-high": {
    fill: "#15803d",
    patternId: "",
    label: "large gain",
  },
  "loss-low": {
    fill: "#fecaca",
    patternId: "",
    label: "small loss",
  },
  "loss-mid": {
    fill: "#f87171",
    patternId: "",
    label: "moderate loss",
  },
  "loss-high": {
    fill: "#b91c1c",
    patternId: "",
    label: "large loss",
  },
};

/**
 * Map a daily return (as a fraction, e.g. 0.012 = +1.2%) to a heatmap bucket.
 * `null`/`undefined`/non-finite values map to `missing`, never to `zero`.
 */
export function getHeatmapBucket(
  dailyReturn: number | null | undefined,
): HeatmapBucket {
  if (dailyReturn == null || !Number.isFinite(dailyReturn)) return "missing";
  if (dailyReturn === 0) return "zero";
  const magnitude = Math.abs(dailyReturn);
  const level =
    magnitude < HEATMAP_THRESHOLDS.low
      ? "low"
      : magnitude < HEATMAP_THRESHOLDS.mid
        ? "mid"
        : "high";
  return `${dailyReturn > 0 ? "gain" : "loss"}-${level}` as HeatmapBucket;
}

/** Style (color, pattern overlay, text label) for a heatmap bucket. */
export function getHeatmapBucketStyle(
  bucket: HeatmapBucket,
): HeatmapBucketStyle {
  return HEATMAP_BUCKETS[bucket] ?? HEATMAP_BUCKETS.missing;
}

/** Convenience: bucket style for a raw daily return value. */
export function getHeatmapStyleForReturn(
  dailyReturn: number | null | undefined,
): HeatmapBucketStyle {
  return getHeatmapBucketStyle(getHeatmapBucket(dailyReturn));
}

/** Chart colors for the user's persisted palette preference. */
export function useChartColors(): ChartColors {
  const palette = useThemeStore((s) => s.chartPalette);
  return getChartColors(palette);
}
