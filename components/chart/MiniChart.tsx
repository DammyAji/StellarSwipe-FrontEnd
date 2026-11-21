"use client";

import { useMemo } from "react";
import { useChartDensityStore, type ChartAxisDensity } from "@/store/useChartDensityStore";
import {
  CHART_FOCUS_OVERLAY_CLASS,
  CHART_KEYBOARD_INSTRUCTIONS,
  formatPercentChange,
  useChartTooltip,
} from "@/hooks/useChartTooltip";
import { useTooltipCollision } from "@/hooks/useTooltipCollision";

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  className?: string;
  /** X-axis tick labels aligned to `data` indices. Falls back to relative offsets (e.g. "-3", "now"). */
  labels?: string[];
  /** Render x-axis labels below the chart. */
  showAxis?: boolean;
  /** Overrides the global chart density preference for this instance. */
  density?: ChartAxisDensity;
}

const DENSITY_TICK_TARGET: Record<ChartAxisDensity, number> = {
  compact: 3,
  standard: 5,
  expanded: 8,
};

// Minimum horizontal space (px) a label needs so labels never overlap/clip.
const MIN_LABEL_SPACING = 28;

/** Picks evenly-spaced data indices to label, capped by both density and available width. */
function computeTickIndices(dataLength: number, density: ChartAxisDensity, widthPx: number): number[] {
  if (dataLength <= 1) return dataLength === 1 ? [0] : [];

  const requested = DENSITY_TICK_TARGET[density];
  const widthLimit = Math.max(2, Math.floor(widthPx / MIN_LABEL_SPACING) + 1);
  const tickCount = Math.max(2, Math.min(requested, widthLimit, dataLength));

  const indices = new Set<number>();
  for (let i = 0; i < tickCount; i++) {
    indices.add(Math.round((i / (tickCount - 1)) * (dataLength - 1)));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function defaultLabel(index: number, dataLength: number): string {
  const offset = dataLength - 1 - index;
  return offset === 0 ? "now" : `-${offset}`;
}

function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function createAreaPath(
  points: { x: number; y: number }[],
  height: number
): string {
  const linePath = createSmoothPath(points);
  if (!linePath) return "";

  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;

  return `${linePath} L ${lastX} ${height} L ${firstX} ${height} Z`;
}

export function MiniChart({
  data,
  width = 120,
  height = 40,
  strokeWidth = 2,
  showArea = true,
  className = "",
  labels,
  showAxis = false,
  density,
}: MiniChartProps) {
  const globalDensity = useChartDensityStore((state) => state.density);
  const effectiveDensity = density ?? globalDensity;
  const { path, areaPath, isPositive, gradientId, points } = useMemo(() => {
    if (!data.length)
      return { path: "", areaPath: "", isPositive: true, gradientId: "", points: [] as { x: number; y: number }[] };

    const values = data;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 2;

    const pts = values.map((value, i) => ({
      x: (i / (values.length - 1)) * (width - padding * 2) + padding,
      y: height - ((value - min) / range) * (height - padding * 2) - padding,
    }));

    const linePath = createSmoothPath(pts);
    const areaPathVal = showArea ? createAreaPath(pts, height) : "";
    const positive = values[values.length - 1] >= values[0];
    const id = `mini-chart-gradient-${Math.random().toString(36).slice(2, 9)}`;

    return { path: linePath, areaPath: areaPathVal, isPositive: positive, gradientId: id, points: pts };
  }, [data, width, height, showArea]);

  const tickIndices = useMemo(
    () => (showAxis ? computeTickIndices(data.length, effectiveDensity, width) : []),
    [showAxis, data.length, effectiveDensity, width]
  );

  const trend = isPositive ? "positive" : "negative";
  const pointLabel = (i: number) => labels?.[i] ?? defaultLabel(i, data.length);
  const { activeIndex, isVisible, activeDescription, tooltipId, instructionsId, containerProps, showAt, hide } =
    useChartTooltip({
      ariaLabel: `Mini chart showing ${trend} trend`,
      describePoint: (i) => {
        const val = data[i];
        if (typeof val !== "number") return "";
        const parts = [`Point ${i + 1} of ${data.length}, ${pointLabel(i)}: ${val.toFixed(4)}`];
        if (i > 0) parts.push(`${formatPercentChange(val, data[i - 1])} from previous point`);
        if (i > 0) parts.push(`${formatPercentChange(val, data[0])} from start`);
        return parts.join(", ");
      },
      dataLength: data.length,
    });
  const { ref: tooltipRef, offset: tooltipOffset } = useTooltipCollision<HTMLDivElement>(
    isVisible,
    [activeIndex]
  );

  // #656: never render a blank box — explain why the chart is unavailable.
  if (!data.length) {
    return (
      <div
        role="status"
        aria-label="No chart data is available yet. Check back once this asset has recorded price history."
        data-testid="chart-unavailable-placeholder"
        className={`flex items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 px-2 text-center text-[11px] text-foreground-muted ${className}`}
        style={{ width, height }}
      >
        <span aria-hidden="true">No chart data yet</span>
      </div>
    );
  }

  const lineColor = isPositive ? "#22c55e" : "#ef4444";
  const areaOpacity = isPositive ? 0.15 : 0.1;

  // Hit-area width per data point
  const hitW = points.length > 1 ? width / points.length : width;

  const chart = (
    <div className={`relative inline-block ${className}`} style={{ width, height }}>
      {/* Accessible live region for screen readers */}
      <span
        id={tooltipId}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isVisible ? activeDescription : ""}
      </span>
      <span id={instructionsId} className="sr-only">
        {CHART_KEYBOARD_INSTRUCTIONS}
      </span>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={areaOpacity} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {showArea && areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Keyboard/touch hit areas — invisible, one per data point */}
        {points.map((pt, i) => (
          <rect
            key={i}
            x={i * hitW}
            y={0}
            width={hitW}
            height={height}
            fill="transparent"
            onPointerEnter={() => showAt(i)}
            onPointerLeave={hide}
            onTouchStart={(e) => { e.preventDefault(); showAt(i); }}
            onTouchEnd={hide}
            style={{ cursor: "crosshair" }}
          />
        ))}

        {/* Dot indicator on active point */}
        {isVisible && activeIndex !== null && points[activeIndex] && (
          <circle
            cx={points[activeIndex].x}
            cy={points[activeIndex].y}
            r={3}
            fill={lineColor}
            stroke="white"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        )}
      </svg>

      {/* Keyboard-navigable overlay (covers the full chart) */}
      <div {...containerProps} className={CHART_FOCUS_OVERLAY_CLASS} />

      {/* Floating tooltip */}
      {isVisible && activeIndex !== null && points[activeIndex] && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-white shadow-md"
          style={{
            left: Math.min(
              Math.max(0, points[activeIndex].x - 24),
              width - 52
            ),
            top: points[activeIndex].y - 44,
            whiteSpace: "nowrap",
            transform: `translate(${tooltipOffset.x}px, ${tooltipOffset.y}px)`,
          }}
          aria-hidden="true"
        >
          <div className="text-slate-300">{pointLabel(activeIndex)}</div>
          <div className="font-semibold">{data[activeIndex].toFixed(4)}</div>
          {activeIndex > 0 && (
            <div className="text-slate-300">{formatPercentChange(data[activeIndex], data[activeIndex - 1])}</div>
          )}
        </div>
      )}
    </div>
  );

  if (!showAxis) return chart;

  return (
    <div className={`inline-block ${className}`}>
      {chart}
      <div className="relative mt-0.5 h-3" aria-hidden="true">
        {tickIndices.map((idx) => {
          const pct = (points[idx].x / width) * 100;
          const isFirst = idx === tickIndices[0];
          const isLast = idx === tickIndices[tickIndices.length - 1];
          return (
            <span
              key={idx}
              className="absolute top-0 whitespace-nowrap text-[9px] leading-3 text-slate-500"
              style={{
                left: `${pct}%`,
                transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {labels?.[idx] ?? defaultLabel(idx, data.length)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
