"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, Share2 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useXLMPriceHistory } from "@/hooks/usePriceHistory";
import {
  computeBenchmarkSeries,
  detectIntervalGaps,
  type IntervalGapReport,
  type PortfolioValuePoint,
} from "@/lib/benchmark";
import { cn } from "@/lib/utils";
import { PortfolioPerformanceBenchmarkChartSkeleton } from "@/components/DashboardWidgetSkeletons";
import {
  CHART_FOCUS_OVERLAY_CLASS,
  CHART_KEYBOARD_INSTRUCTIONS,
  formatPercentChange,
  useChartTooltip,
} from "@/hooks/useChartTooltip";
import { useTooltipCollision } from "@/hooks/useTooltipCollision";
import { useChartColors } from "@/lib/chartPalette";
import {
  ChartIntervalSelector,
  UnsupportedIntervalCallout,
  useChartInterval,
} from "@/components/chart/ChartIntervalSelector";
import { CHART_INTERVALS } from "@/store/useChartIntervalStore";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  DEFAULT_BENCHMARK_ID,
  deriveBenchmarkPrices,
  formatBenchmarkFreshness,
  getBenchmark,
  isBenchmarkUsable,
} from "@/lib/benchmarks";
import { BenchmarkSelector } from "@/components/chart/BenchmarkSelector";
import { ChartSnapshotDialog, type SnapshotChartOption } from "@/components/chart/ChartSnapshotDialog";
import {
  AddAnnotationButton,
  AnnotationEditor,
  AnnotationList,
  AnnotationMarker,
  formatAnnotationDate,
} from "@/components/chart/ChartAnnotations";
import { toDayKey, useChartAnnotations, type ChartAnnotation } from "@/hooks/useChartAnnotations";
import { useCurrencyStore, EXCHANGE_RATES } from "@/store/useCurrencyStore";
import { formatCurrency } from "@/lib/localeFormatter";
import { LargestDailyMovements } from "./LargestDailyMovements";
import { PortfolioSnapshotDateBrowser } from "./PortfolioSnapshotDateBrowser";

const CHART_ID = "portfolio-performance-benchmark";
const PORTFOLIO_METRIC = "portfolio-value";
const BENCHMARK_STORAGE_KEY = "stellarswipe:benchmark";

const RANGE_OPTIONS = [
  { points: 7, label: "7D" },
  { points: 30, label: "30D" },
  { points: 90, label: "90D" },
] as const;

const RANGE_URL_PARAM = "range";
const DEFAULT_RANGE_POINTS = 30;

/** Parse a `?range=` value, falling back to the default for unsupported values. */
function parseRangeParam(raw: string | null): number {
  if (!raw) return DEFAULT_RANGE_POINTS;
  const parsed = Number(raw);
  return RANGE_OPTIONS.some((option) => option.points === parsed)
    ? parsed
    : DEFAULT_RANGE_POINTS;
}

type EditorState =
  | { mode: "create"; timestamp: number }
  | { mode: "edit"; annotation: ChartAnnotation }
  | null;

interface PortfolioPerformanceBenchmarkChartProps {
  className?: string;
}

function createSmoothPath(
  points: { x: number; y: number }[],
  height: number,
  breakBefore: boolean[] = []
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // #1049: never draw a segment across an interval with no data — that would
    // present an interpolated value as real performance.
    if (breakBefore[i + 1]) {
      path += ` M ${p2.x} ${p2.y}`;
      continue;
    }

    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function formatGapDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function describeGapReport(report: IntervalGapReport, label: string): string {
  if (report.gaps.length === 0) return "";
  const ranges = report.gaps
    .map((gap) => `${formatGapDate(gap.from)} – ${formatGapDate(gap.to)}`)
    .join(", ");
  const unit = report.missingIntervals === 1 ? "interval" : "intervals";
  return `${label}: ${report.missingIntervals} ${unit} with no data (${ranges}). The line is broken across these gaps instead of interpolating values.`;
}

export function PortfolioPerformanceBenchmarkChart({
  className,
}: PortfolioPerformanceBenchmarkChartProps) {
  const { totalValue, assets, isLoading } = usePortfolioStore();
  const [showBenchmark, setShowBenchmark] = useState(true);
  const chartColors = useChartColors();
  const [rangePoints, setRangePoints] = useState<number>(DEFAULT_RANGE_POINTS);
  const [benchmarkId, setBenchmarkId] = useState<string>(DEFAULT_BENCHMARK_ID);
  const [benchmarkRetryKey, setBenchmarkRetryKey] = useState(0);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedMovementDay, setSelectedMovementDay] = useState<number | null>(null);
  const [selectedSnapshotDay, setSelectedSnapshotDay] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  // #1048: the data-table view mirrors the chart's series in the user's
  // selected display currency.
  const [showDataTable, setShowDataTable] = useState(false);
  const displayCurrency = useCurrencyStore((state) => state.currency);
  const currencyRate = EXCHANGE_RATES[displayCurrency] ?? 1;
  const { annotations, addAnnotation, updateAnnotation, removeAnnotation } =
    useChartAnnotations(CHART_ID);

  // Supported intervals — benchmark chart has enough mock data for these.
  const SUPPORTED_INTERVALS = ["1W", "1M", "3M", "1Y"] as const;
  const { interval, setInterval, isSupported } = useChartInterval({
    supportedIntervals: [...SUPPORTED_INTERVALS],
    syncToUrl: true,
    urlParamKey: "portfolioInterval",
  });

  const intervalMeta = CHART_INTERVALS[interval];

  // #1046: keep the selected range in the URL so it can be bookmarked/shared,
  // and restore it (including back/forward navigation) when the URL changes.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get(RANGE_URL_PARAM);

  useEffect(() => {
    const next = parseRangeParam(rangeParam);
    setRangePoints((current) => (current === next ? current : next));
  }, [rangeParam]);

  const changeRange = useCallback(
    (points: number) => {
      setRangePoints(points);
      const params = new URLSearchParams(searchParams.toString());
      params.set(RANGE_URL_PARAM, String(points));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Restore the last chosen benchmark; fall back to the default if the saved
  // id is no longer offered.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BENCHMARK_STORAGE_KEY);
      if (saved && getBenchmark(saved)) setBenchmarkId(saved);
    } catch {
      // storage unavailable
    }
  }, []);

  const changeBenchmark = useCallback((id: string) => {
    setBenchmarkId(id);
    try {
      window.localStorage.setItem(BENCHMARK_STORAGE_KEY, id);
    } catch {
      // storage unavailable
    }
  }, []);

  const benchmark = getBenchmark(benchmarkId) ?? getBenchmark(DEFAULT_BENCHMARK_ID)!;
  const benchmarkUsable = isBenchmarkUsable(benchmark);
  const benchmarkLabel = benchmark.label;

  const baseHistory = useXLMPriceHistory({
    points: intervalMeta.points,
    interval: intervalMeta.historyInterval,
  });
  const xlmHistory = useMemo(
    () => (benchmarkUsable ? deriveBenchmarkPrices(benchmark, baseHistory) : []),
    // benchmarkRetryKey lets "Retry" re-request the benchmark feed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benchmark, benchmarkUsable, baseHistory, benchmarkRetryKey]
  );
  const portfolioHistory = useMemo(() => {
    const initial = assets.reduce(
      (sum, a) => sum + (a.value - (a.unrealizedPnL ?? 0)),
      0
    );
    const history: PortfolioValuePoint[] = baseHistory.slice(0, -1).map((point) => ({
      timestamp: point.timestamp,
      value: initial + Math.random() * 200,
    }));
    history.push({ timestamp: Date.now(), value: totalValue });
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }, [baseHistory, totalValue, assets]);

  const { portfolio: portfolioPoints, benchmark: benchmarkPoints } =
    useMemo(() => {
      const initialPortfolioValue = portfolioHistory[0]?.value ?? totalValue;
      if (xlmHistory.length === 0) {
        // Benchmark unavailable: still chart the portfolio on its own.
        return {
          portfolio: [...portfolioHistory].sort((a, b) => a.timestamp - b.timestamp),
          benchmark: [] as PortfolioValuePoint[],
        };
      }
      return computeBenchmarkSeries(
        portfolioHistory,
        xlmHistory,
        initialPortfolioValue
      );
    }, [portfolioHistory, xlmHistory, totalValue]);

  // #1049: detect intervals with no data so the chart can explain them and
  // avoid drawing interpolated values as real performance.
  const expectedIntervalMs = useMemo(() => {
    const intervalMs =
      intervalMeta.historyInterval === "hour"
        ? 3_600_000
        : intervalMeta.historyInterval === "week"
          ? 604_800_000
          : 86_400_000;
    return intervalMs;
  }, [intervalMeta.historyInterval]);

  const portfolioGaps = useMemo(
    () => detectIntervalGaps(portfolioPoints, expectedIntervalMs),
    [portfolioPoints, expectedIntervalMs]
  );
  const benchmarkGaps = useMemo(
    () => detectIntervalGaps(benchmarkPoints, expectedIntervalMs),
    [benchmarkPoints, expectedIntervalMs]
  );

  const chartData = useMemo(() => {
    if (portfolioPoints.length === 0) {
      return { portfolioPath: "", benchmarkPath: "", maxVal: 0, minVal: 0, portfolioPts: [], benchmarkPts: [] };
    }

    const width = 320;
    const height = 160;
    const padding = 20;

    const allValues = [
      ...portfolioPoints.map((p) => p.value),
      ...benchmarkPoints.map((p) => p.value),
    ];
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    const range = maxVal - minVal || 1;

    const portfolioPts = portfolioPoints.map((point, i) => ({
      x: (i / (portfolioPoints.length - 1)) * (width - padding * 2) + padding,
      y:
        height -
        ((point.value - minVal) / range) * (height - padding * 2) -
        padding,
      value: point.value,
      timestamp: point.timestamp,
    }));

    const benchmarkPts = benchmarkPoints.map((point, i) => ({
      x: (i / (benchmarkPoints.length - 1)) * (width - padding * 2) + padding,
      y:
        height -
        ((point.value - minVal) / range) * (height - padding * 2) -
        padding,
      value: point.value,
      timestamp: point.timestamp,
    }));

    return {
      portfolioPath: createSmoothPath(portfolioPts, height),
      benchmarkPath: createSmoothPath(benchmarkPts, height),
      maxVal,
      minVal,
      width,
      height,
      portfolioPts,
      benchmarkPts,
    };
  }, [portfolioPoints, benchmarkPoints]);

  // #1087: the summary values follow the date picked in the snapshot browser.
  // When no date is picked (or the picked date is no longer available) the
  // latest point is used, so the summary never shows a stale selection.
  const selectedSnapshotIndex = useMemo(() => {
    if (selectedSnapshotDay === null) return null;
    const index = portfolioPoints.findIndex(
      (point) => toDayKey(point.timestamp) === selectedSnapshotDay
    );
    return index === -1 ? null : index;
  }, [portfolioPoints, selectedSnapshotDay]);

  const summaryEndIndex =
    selectedSnapshotIndex ?? portfolioPoints.length - 1;

  // #1087: the browser only offers dates the chart can actually back up.
  const availableSnapshotDays = useMemo(
    () =>
      Array.from(
        new Set(portfolioPoints.map((point) => toDayKey(point.timestamp)))
      ).sort((a, b) => b - a),
    [portfolioPoints]
  );

  const performanceDelta = useMemo(() => {
    if (portfolioPoints.length === 0 || benchmarkPoints.length === 0)
      return null;

    const startPortfolio = portfolioPoints[0].value;
    const endPortfolio = portfolioPoints[summaryEndIndex].value;
    const startBenchmark = benchmarkPoints[0].value;
    const endBenchmarkIndex = Math.min(
      summaryEndIndex,
      benchmarkPoints.length - 1
    );
    const endBenchmark = benchmarkPoints[endBenchmarkIndex].value;

    const portfolioReturn =
      ((endPortfolio - startPortfolio) / startPortfolio) * 100;
    const benchmarkReturn =
      ((endBenchmark - startBenchmark) / startBenchmark) * 100;

    return {
      portfolioReturn: parseFloat(portfolioReturn.toFixed(2)),
      benchmarkReturn: parseFloat(benchmarkReturn.toFixed(2)),
      outperformance: parseFloat(
        (portfolioReturn - benchmarkReturn).toFixed(2)
      ),
    };
  }, [portfolioPoints, benchmarkPoints, summaryEndIndex]);

  // Pairs each portfolio point with the benchmark point closest in time, so
  // the active point can be compared against the benchmark.
  const benchmarkIndexFor = (i: number): number | null => {
    const pt = chartData.portfolioPts[i];
    if (!pt || chartData.benchmarkPts.length === 0) return null;
    let best = 0;
    for (let j = 1; j < chartData.benchmarkPts.length; j++) {
      if (
        Math.abs(chartData.benchmarkPts[j].timestamp - pt.timestamp) <
        Math.abs(chartData.benchmarkPts[best].timestamp - pt.timestamp)
      ) {
        best = j;
      }
    }
    return best;
  };

  const annotationsForDay = (timestamp: number) => {
    const day = toDayKey(timestamp);
    return annotations.filter((a) => a.metric === PORTFOLIO_METRIC && a.day === day);
  };

  const formatPointDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // #1048: rows for the data-table view — one per portfolio point, with the
  // benchmark value matched by calendar day, converted to the display currency.
  const tableRows = useMemo(() => {
    const benchByDay = new Map(
      benchmarkPoints.map((p) => [toDayKey(p.timestamp), p.value])
    );
    const startValue = portfolioPoints[0]?.value ?? 0;
    return portfolioPoints.map((point) => {
      const bench = benchByDay.get(toDayKey(point.timestamp));
      return {
        timestamp: point.timestamp,
        portfolio: point.value * currencyRate,
        benchmark: bench !== undefined ? bench * currencyRate : null,
        change: formatPercentChange(point.value, startValue),
      };
    });
  }, [portfolioPoints, benchmarkPoints, currencyRate]);

  // A single keyboard navigator covers both series: each point reports the
  // portfolio value plus, when shown, the benchmark comparison.
  const tooltip = useChartTooltip({
    ariaLabel: `Portfolio performance versus ${benchmark.name} benchmark`,
    describePoint: (i) => {
      const pt = chartData.portfolioPts[i];
      if (!pt) return "";
      const start = chartData.portfolioPts[0].value;
      const parts = [
        `Point ${i + 1} of ${chartData.portfolioPts.length}, ${formatPointDate(pt.timestamp)}`,
        `Portfolio $${pt.value.toFixed(2)}, ${formatPercentChange(pt.value, start)} since start`,
      ];
      const j = showBenchmark ? benchmarkIndexFor(i) : null;
      if (j !== null) {
        const bench = chartData.benchmarkPts[j];
        const benchStart = chartData.benchmarkPts[0].value;
        const gap = pt.value - bench.value;
        parts.push(
          `${benchmarkLabel} benchmark $${bench.value.toFixed(2)}, ${formatPercentChange(bench.value, benchStart)} since start`,
          `Portfolio ${gap >= 0 ? "ahead of" : "behind"} benchmark by $${Math.abs(gap).toFixed(2)}`
        );
      }
      const notes = annotationsForDay(pt.timestamp);
      if (notes.length > 0) {
        parts.push(`${notes.length} ${notes.length === 1 ? "note" : "notes"}: ${notes.map((n) => n.note).join("; ")}`);
      }
      return parts.join(". ");
    },
    dataLength: chartData.portfolioPts?.length ?? 0,
  });
  const { ref: tooltipRef, offset: tooltipOffset } =
    useTooltipCollision<HTMLDivElement>(tooltip.isVisible, [tooltip.activeIndex]);

  // Remember the last inspected point so "Add note" still works after the
  // pointer leaves the chart or focus moves to the button.
  useEffect(() => {
    if (tooltip.activeIndex !== null) setSelectedPointIndex(tooltip.activeIndex);
  }, [tooltip.activeIndex]);

  useEffect(() => {
    setSelectedPointIndex(null);
  }, [rangePoints]);

  // Drop a snapshot selection that no longer exists in the current range so
  // the summary never reports a date the chart cannot back up.
  useEffect(() => {
    if (selectedSnapshotDay === null) return;
    const stillAvailable = portfolioPoints.some(
      (point) => toDayKey(point.timestamp) === selectedSnapshotDay
    );
    if (!stillAvailable) setSelectedSnapshotDay(null);
  }, [portfolioPoints, selectedSnapshotDay]);

  const selectedPoint =
    selectedPointIndex !== null ? chartData.portfolioPts[selectedPointIndex] ?? null : null;

  const selectedSnapshotPoint =
    selectedSnapshotIndex !== null
      ? portfolioPoints[selectedSnapshotIndex] ?? null
      : null;

  // Handle selection from LargestDailyMovements component
  const handleSelectMovement = useCallback(
    (_movement: import("@/lib/dailyMovements").DailyMovement, pointIndex: number) => {
      setSelectedPointIndex(pointIndex);
      setSelectedMovementDay(portfolioPoints[pointIndex]?.timestamp ?? null);
      tooltip.showAt(pointIndex);
    },
    [portfolioPoints, tooltip]
  );

  const rangeStartDay = portfolioPoints.length > 0 ? toDayKey(portfolioPoints[0].timestamp) : 0;
  const rangeEndDay =
    portfolioPoints.length > 0 ? toDayKey(portfolioPoints[portfolioPoints.length - 1].timestamp) : 0;
  const isAnnotationInRange = useCallback(
    (a: ChartAnnotation) => a.day >= rangeStartDay && a.day <= rangeEndDay,
    [rangeStartDay, rangeEndDay]
  );

  const snapshotCharts = useMemo<SnapshotChartOption[]>(() => {
    const benchmarkSeries = {
      id: "benchmark",
      label: `${benchmark.label} (benchmark)`,
      color: chartColors.secondary,
      dashed: true,
      points: benchmarkPoints,
    };
    const portfolioSeries = {
      id: "portfolio",
      label: "Portfolio",
      color: chartColors.primary,
      isPrivate: true,
      points: portfolioPoints,
    };
    const source = `${benchmark.name}: ${benchmark.source} (${formatBenchmarkFreshness(benchmark).toLowerCase()})`;
    return [
      {
        id: "portfolio-vs-benchmark",
        title: `Portfolio performance vs ${benchmark.label}`,
        unit: "USD",
        sources: benchmarkPoints.length > 0 ? [source] : [],
        series: benchmarkPoints.length > 0 ? [portfolioSeries, benchmarkSeries] : [portfolioSeries],
      },
      ...(benchmarkPoints.length > 0
        ? [
            {
              id: "benchmark-only",
              title: `${benchmark.name} performance`,
              unit: benchmark.unit,
              sources: [source],
              series: [benchmarkSeries],
            },
          ]
        : []),
    ];
  }, [benchmark, benchmarkPoints, portfolioPoints, chartColors]);

  const exportCsv = useCallback(() => {
    try {
      const benchByDay = new Map(benchmarkPoints.map((p) => [toDayKey(p.timestamp), p.value]));
      const rows = [
        `# Benchmark: ${benchmark.name}`,
        `# Benchmark source: ${benchmark.source}`,
        `# Benchmark last updated: ${new Date(benchmark.lastUpdated).toISOString()}`,
        `date,portfolio_usd,${benchmark.id}_benchmark_usd`,
        ...portfolioPoints.map((p) => {
          const bench = benchByDay.get(toDayKey(p.timestamp));
          return `${new Date(p.timestamp).toISOString().slice(0, 10)},${p.value.toFixed(2)},${bench !== undefined ? bench.toFixed(2) : ""}`;
        }),
      ];
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-vs-${benchmark.id}-${rangePoints}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Performance exported", {
        description: `CSV includes the ${benchmark.name} benchmark and its source.`,
      });
    } catch {
      toast.error("Export failed", { description: "Please try again." });
    }
  }, [benchmark, benchmarkPoints, portfolioPoints, rangePoints]);

  function saveEditor(note: string) {
    if (!editor) return;
    if (editor.mode === "create") {
      addAnnotation(PORTFOLIO_METRIC, editor.timestamp, note);
      toast.success("Note added");
    } else {
      updateAnnotation(editor.annotation.id, note);
      toast.success("Note updated");
    }
    setEditor(null);
  }

  function deleteAnnotation(a: ChartAnnotation) {
    removeAnnotation(a.id);
    if (editor?.mode === "edit" && editor.annotation.id === a.id) setEditor(null);
    toast.success("Note removed");
  }

  if (isLoading) {
    return <PortfolioPerformanceBenchmarkChartSkeleton className={className} />;
  }

  if (assets.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">
            Portfolio Performance vs {benchmark.label} Benchmark
          </h2>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No portfolio history yet"
            description={`Once you hold at least one asset, we'll chart your performance against the ${benchmark.name} benchmark here.`}
            action={
              <Button asChild size="sm" variant="outline">
                <a href="/app">Add your first asset</a>
              </Button>
            }
            className="h-48 rounded-xl bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  // #684: assets exist, but there isn't yet enough price history to plot a
  // meaningful line (e.g. the benchmark feed hasn't returned points yet).
  // Show a clear explanation instead of a blank chart area.
  const hasChartableHistory = Boolean(chartData.portfolioPath) && portfolioPoints.length > 0;
  if (!hasChartableHistory) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">
            Portfolio Performance vs {benchmark.label} Benchmark
          </h2>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Not enough history yet"
            description={`We need a bit more price history before we can chart your performance against the ${benchmark.name} benchmark. Check back shortly.`}
            action={
              <Button asChild size="sm" variant="outline">
                <a href="/performance">View performance details</a>
              </Button>
            }
            className="h-48 rounded-xl bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  const outperformance = performanceDelta?.outperformance ?? 0;
  const isOutperforming = outperformance >= 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            Portfolio Performance vs {benchmark.label} Benchmark
          </h2>
          {/* Range selector — synced with the URL so ranges are shareable */}
          <div
            role="group"
            aria-label="Chart range"
            className="flex items-center gap-1"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.points}
                type="button"
                aria-pressed={rangePoints === option.points}
                onClick={() => changeRange(option.points)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  rangePoints === option.points
                    ? "bg-blue-500 text-white"
                    : "bg-surface-high text-foreground-muted hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Interval selector — stable layout, loading state preserved */}
          <ChartIntervalSelector
            supportedIntervals={[...SUPPORTED_INTERVALS]}
            value={interval}
            onChange={setInterval}
            isLoading={isLoading}
            syncToUrl={false}
            size="sm"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {/* Benchmark toggle — stable layout; toggling does not affect interval or zoom */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              id="benchmark-toggle"
              aria-checked={showBenchmark}
              aria-label="Show XLM benchmark series"
              onClick={() => setShowBenchmark((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                showBenchmark ? "bg-blue-500" : "bg-surface-high"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                  showBenchmark ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
            <label
              htmlFor="benchmark-toggle"
              className="cursor-pointer select-none text-xs text-foreground-muted"
              onClick={() => setShowBenchmark((v) => !v)}
            >
              XLM benchmark
            </label>
          </div>
          {performanceDelta && (
            <p className="text-xs text-foreground-muted">
              Outperformance:{" "}
              <span
                className={cn(
                  isOutperforming ? "text-green-400" : "text-red-400"
                )}
              >
                {isOutperforming ? "+" : ""}
                {outperformance}%
              </span>
            </p>
          )}
        </div>
        {/* Unsupported interval callout */}
        {!isSupported && (
          <UnsupportedIntervalCallout
            interval={interval}
            supportedIntervals={[...SUPPORTED_INTERVALS]}
            onSelectSupported={setInterval}
            className="mt-2"
          />
        )}
      </CardHeader>
      <CardContent>
        <div className="relative h-48 sm:h-56">
          {/* Accessible live region and instructions for screen readers */}
          <span
            id={tooltip.tooltipId}
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {tooltip.isVisible ? tooltip.activeDescription : ""}
          </span>
          <span id={tooltip.instructionsId} className="sr-only">
            {CHART_KEYBOARD_INSTRUCTIONS}
          </span>
          {/* Accessible chart summary — updates when benchmark is toggled */}
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {showBenchmark
              ? "Portfolio performance chart showing portfolio and XLM benchmark series."
              : "Portfolio performance chart showing portfolio series only. XLM benchmark is hidden."}
          </span>

          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            role="group"
            aria-label="Chart notes"
            className="overflow-visible"
          >
            <g aria-hidden="true">
            {showBenchmark && chartData.benchmarkPath && (
              <path
                d={chartData.benchmarkPath}
                fill="none"
                stroke={chartColors.secondary}
                strokeWidth={2}
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chartData.portfolioPath && (
              <path
                d={chartData.portfolioPath}
                fill="none"
                stroke={chartColors.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {showBenchmark && chartData.benchmarkPath && (
              <text
                x={(chartData?.width ?? 0) - 4}
                y={14}
                fontSize={9}
                fill={chartColors.secondary}
                textAnchor="end"
              >
                {benchmark.label} (benchmark)
              </text>
            )}
            <text
              x={(chartData?.width ?? 0) - 4}
              y={showBenchmark ? 26 : 14}
              fontSize={9}
              fill={chartColors.primary}
              textAnchor="end"
            >
              ─ Portfolio
            </text>
            </g>

            {/* Invisible pointer/touch hit areas, one per point */}
            {chartData.portfolioPts.map((pt, i) => {
              const hitW = chartData.portfolioPts.length > 1
                ? (chartData.width ?? 320) / chartData.portfolioPts.length
                : chartData.width ?? 320;
              return (
                <rect
                  key={`p-${i}`}
                  x={i * hitW}
                  y={0}
                  width={hitW}
                  height={chartData.height ?? 160}
                  fill="transparent"
                  onPointerEnter={() => tooltip.showAt(i)}
                  onPointerLeave={tooltip.hide}
                  onClick={() => setSelectedPointIndex(i)}
                  onTouchStart={(e) => { e.preventDefault(); tooltip.showAt(i); setSelectedPointIndex(i); }}
                  onTouchEnd={tooltip.hide}
                  style={{ cursor: "crosshair" }}
                />
              );
            })}

            {/* Annotation markers (#783), matched to points by calendar day */}
            {annotations.map((a) => {
              if (a.metric !== PORTFOLIO_METRIC) return null;
              const pt = chartData.portfolioPts.find((p) => toDayKey(p.timestamp) === a.day);
              if (!pt) return null;
              return (
                <AnnotationMarker
                  key={a.id}
                  x={pt.x}
                  y={pt.y}
                  annotation={a}
                  metricLabel="Portfolio value"
                  color={chartColors.primary}
                  isActive={editor?.mode === "edit" && editor.annotation.id === a.id}
                  onActivate={(annotation) => setEditor({ mode: "edit", annotation })}
                />
              );
            })}

            {/* Active dots */}
            {tooltip.activeIndex !== null && chartData.portfolioPts[tooltip.activeIndex] && (() => {
              const pt = chartData.portfolioPts[tooltip.activeIndex];
              const j = showBenchmark ? benchmarkIndexFor(tooltip.activeIndex) : null;
              const bench = j !== null ? chartData.benchmarkPts[j] : null;
              return (
                <g aria-hidden="true">
                  <line
                    x1={pt.x}
                    x2={pt.x}
                    y1={0}
                    y2={chartData.height ?? 160}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                    strokeDasharray="2 2"
                    className="text-foreground"
                  />
                  {bench && (
                    <circle cx={bench.x} cy={bench.y} r={4} fill={chartColors.secondary} stroke="white" strokeWidth={1.5} />
                  )}
                  <circle cx={pt.x} cy={pt.y} r={4} fill={chartColors.primary} stroke="white" strokeWidth={1.5} />
                </g>
              );
            })()}
          </svg>

          {/* Keyboard focus target (pointer events pass through to the hit areas) */}
          <div {...tooltip.containerProps} className={CHART_FOCUS_OVERLAY_CLASS} />

          {/* Floating tooltip */}
          {tooltip.activeIndex !== null &&
            chartData.portfolioPts[tooltip.activeIndex] && (() => {
              const i = tooltip.activeIndex;
              const pt = chartData.portfolioPts[i];
              const j = showBenchmark ? benchmarkIndexFor(i) : null;
              const bench = j !== null ? chartData.benchmarkPts[j] : null;
              const gap = bench ? pt.value - bench.value : null;
              return (
                <div
                  ref={tooltipRef}
                  role="tooltip"
                  className="pointer-events-none absolute z-10 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-white shadow-md"
                  style={{
                    left: Math.min(Math.max(0, pt.x - 24), (chartData.width ?? 320) - 110),
                    top: Math.max(0, pt.y - (bench ? 64 : 40)),
                    whiteSpace: "nowrap",
                    transform: `translate(${tooltipOffset.x}px, ${tooltipOffset.y}px)`,
                  }}
                  aria-hidden="true"
                >
                  <div className="text-slate-300">{formatPointDate(pt.timestamp)}</div>
                  <div>
                    <span className="font-semibold text-green-400">Portfolio</span> ${pt.value.toFixed(2)}
                  </div>
                  {bench && gap !== null && (
                    <>
                      <div>
                        <span className="font-semibold text-blue-400">{benchmark.label}</span> ${bench.value.toFixed(2)}
                      </div>
                      <div className="text-slate-300">
                        {gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)} vs benchmark
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
        </div>
        {performanceDelta && (
          <>
            {/* Legend — stable layout regardless of whether benchmark is shown */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-label="Chart legend">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded bg-green-400" aria-hidden="true" />
                <span className="text-foreground-muted">Portfolio</span>
              </div>
              {showBenchmark ? (
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0.5 w-5 rounded bg-blue-400"
                    style={{ borderStyle: "dashed", height: 0, borderTopWidth: 2, borderTopColor: "rgb(96,165,250)", borderTopStyle: "dashed" }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground-muted">XLM benchmark</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 opacity-40">
                  <span className="inline-block h-0.5 w-5 rounded bg-blue-400 line-through" aria-hidden="true" />
                  <span className="text-foreground-muted line-through">XLM benchmark (hidden)</span>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-foreground-muted">
                  {selectedSnapshotIndex !== null
                    ? "Portfolio return to selected date"
                    : "Portfolio return"}
                </span>
                <p
                  className={cn(
                    "font-mono",
                    performanceDelta.portfolioReturn >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  )}
                >
                  {performanceDelta.portfolioReturn >= 0 ? "+" : ""}
                  {performanceDelta.portfolioReturn}%
                </p>
              </div>
              {showBenchmark ? (
                <div>
                  <span className="text-foreground-muted">
                    {selectedSnapshotIndex !== null
                      ? "XLM return to selected date"
                      : "XLM return"}
                  </span>
                  <p className="font-mono text-blue-400">
                    {performanceDelta.benchmarkReturn >= 0 ? "+" : ""}
                    {performanceDelta.benchmarkReturn}%
                  </p>
                </div>
              ) : (
                <div aria-hidden="true" className="opacity-0 select-none">
                  {/* Placeholder to preserve grid layout when benchmark is hidden */}
                  <span className="text-foreground-muted">
                    {selectedSnapshotIndex !== null
                      ? "XLM return to selected date"
                      : "XLM return"}
                  </span>
                  <p className="font-mono">—</p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground-muted">
          <span aria-live="polite">
            {selectedSnapshotPoint
              ? `Snapshot date: ${formatAnnotationDate(
                  toDayKey(selectedSnapshotPoint.timestamp)
                )} · $${selectedSnapshotPoint.value.toFixed(2)}`
              : selectedPoint
                ? `Selected: ${formatAnnotationDate(toDayKey(selectedPoint.timestamp))}`
                : "Select a point to add a note."}
          </span>
          <AddAnnotationButton
            disabled={!selectedPoint || editor !== null}
            dateLabel={selectedPoint ? formatAnnotationDate(toDayKey(selectedPoint.timestamp)) : null}
            onClick={() => {
              if (!selectedPoint) return;
              const existing = annotationsForDay(selectedPoint.timestamp)[0];
              setEditor(
                existing
                  ? { mode: "edit", annotation: existing }
                  : { mode: "create", timestamp: selectedPoint.timestamp }
              );
            }}
          />
        </div>

        {editor && (
          <AnnotationEditor
            mode={editor.mode}
            metricLabel="Portfolio value"
            dateLabel={formatAnnotationDate(
              editor.mode === "create" ? toDayKey(editor.timestamp) : editor.annotation.day
            )}
            initialNote={editor.mode === "edit" ? editor.annotation.note : ""}
            onSave={saveEditor}
            onDelete={
              editor.mode === "edit" ? () => deleteAnnotation(editor.annotation) : undefined
            }
            onCancel={() => setEditor(null)}
          />
        )}

        {/* Largest Daily Movements */}
        <PortfolioSnapshotDateBrowser
          availableDays={availableSnapshotDays}
          selectedDay={selectedSnapshotDay}
          onSelectDay={setSelectedSnapshotDay}
          className="mt-3"
        />

        <LargestDailyMovements
          portfolioHistory={portfolioPoints}
          chartPortfolioPts={chartData.portfolioPts}
          chartWidth={chartData.width ?? 0}
          chartHeight={chartData.height ?? 0}
          onSelectMovement={handleSelectMovement}
          selectedDay={selectedMovementDay}
          className="mt-3"
        />

        <AnnotationList
          annotations={annotations.filter((a) => a.metric === PORTFOLIO_METRIC)}
          metricLabel={() => "Portfolio value"}
          isInRange={isAnnotationInRange}
          activeId={editor?.mode === "edit" ? editor.annotation.id : null}
          onEdit={(annotation) => setEditor({ mode: "edit", annotation })}
          onRemove={deleteAnnotation}
        />

        {/* #1048: semantic, mobile-usable data-table view of the chart series */}
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showDataTable}
            aria-controls="portfolio-performance-data-table"
            onClick={() => setShowDataTable((v) => !v)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              "bg-surface-high text-foreground-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            )}
          >
            {showDataTable ? "Hide data table" : "Show data table"}
          </button>

          {showDataTable && (
            <div
              id="portfolio-performance-data-table"
              className="mt-2 max-h-64 overflow-auto rounded-lg border border-border"
            >
              <table className="w-full border-collapse text-left text-xs">
                <caption className="sr-only">
                  Portfolio performance data for the last {rangePoints} days, values
                  in {displayCurrency}
                  {showBenchmark ? `, with the ${benchmark.label} benchmark` : ""}.
                </caption>
                <thead className="sticky top-0 bg-surface-high">
                  <tr>
                    <th scope="col" className="px-2 py-1.5 font-medium text-foreground-muted">
                      Date
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium text-foreground-muted">
                      Portfolio ({displayCurrency})
                    </th>
                    {showBenchmark && (
                      <th scope="col" className="px-2 py-1.5 text-right font-medium text-foreground-muted">
                        {benchmark.label} ({displayCurrency})
                      </th>
                    )}
                    <th scope="col" className="px-2 py-1.5 text-right font-medium text-foreground-muted">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.timestamp} className="border-t border-border">
                      <th scope="row" className="whitespace-nowrap px-2 py-1.5 font-normal text-foreground">
                        {formatPointDate(row.timestamp)}
                      </th>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-foreground">
                        {formatCurrency(row.portfolio, displayCurrency)}
                      </td>
                      {showBenchmark && (
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-foreground-muted">
                          {row.benchmark !== null
                            ? formatCurrency(row.benchmark, displayCurrency)
                            : "—"}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-foreground-muted">
                        {row.change}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] text-foreground-muted">
          Benchmark: {benchmark.name} · Source: {benchmark.source} ·{" "}
          {formatBenchmarkFreshness(benchmark)}
        </p>
      </CardContent>

      <ChartSnapshotDialog
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        charts={snapshotCharts}
        defaultChartId="portfolio-vs-benchmark"
      />
    </Card>
  );
}
