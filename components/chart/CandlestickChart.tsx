"use client";

import { useMemo } from "react";
import {
  CHART_FOCUS_OVERLAY_CLASS,
  CHART_KEYBOARD_INSTRUCTIONS,
  formatPercentChange,
  useChartTooltip,
} from "@/hooks/useChartTooltip";
import { useTooltipCollision } from "@/hooks/useTooltipCollision";

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

interface CandlestickChartProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

function deriveCandles(values: number[]): Candle[] {
  return values.map((v, i) => {
    const open = i === 0 ? v : values[i - 1];
    const close = v;
    const range = Math.abs(close - open);
    const wick = range * 0.3 + 0.05;
    return {
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.min(open, close) - wick,
    };
  });
}

export function CandlestickChart({
  data,
  width = 120,
  height = 40,
  className = "",
}: CandlestickChartProps) {
  const candles = useMemo(
    () => (data.length ? deriveCandles(data) : []),
    [data]
  );

  const { activeIndex, isVisible, activeDescription, tooltipId, instructionsId, containerProps, showAt, hide } =
    useChartTooltip({
      ariaLabel: "Candlestick chart",
      describePoint: (i) => {
        const c = candles[i];
        if (!c) return "";
        const dir = c.close >= c.open ? "up" : "down";
        const change = formatPercentChange(c.close, c.open);
        const vsPrevious = i > 0 ? `, ${formatPercentChange(c.close, candles[i - 1].close)} from previous close` : "";
        return `Candle ${i + 1} of ${candles.length}: ${dir} ${change}. Open ${c.open.toFixed(4)}, Close ${c.close.toFixed(4)}, High ${c.high.toFixed(4)}, Low ${c.low.toFixed(4)}${vsPrevious}`;
      },
      dataLength: candles.length,
    });
  const { ref: tooltipRef, offset: tooltipOffset } = useTooltipCollision<HTMLDivElement>(
    isVisible,
    [activeIndex]
  );

  // #656: never render a blank box — explain why the chart is unavailable.
  if (!candles.length) {
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

  const allVals = candles.flatMap((c) => [c.high, c.low]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;
  const pad = 3;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const toY = (v: number) => height - pad - ((v - minVal) / range) * chartH;

  const gap = 1;
  const bodyW = Math.max(2, chartW / candles.length - gap);

  // Tooltip position for the active candle
  const activeCandle = activeIndex !== null ? candles[activeIndex] : null;
  const tooltipX =
    activeIndex !== null
      ? pad + (activeIndex / candles.length) * chartW + bodyW / 2
      : 0;
  const tooltipY =
    activeCandle ? toY(activeCandle.high) - 6 : 0;

  return (
    <div className={`relative inline-block ${className}`} style={{ width, height }}>
      {/* Accessible live region */}
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
        {candles.map((c, i) => {
          const cx = pad + (i / candles.length) * chartW + bodyW / 2;
          const isUp = c.close >= c.open;
          const color = isUp ? "#22c55e" : "#ef4444";
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBottom = toY(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const isActive = activeIndex === i;

          return (
            <g
              key={i}
              onPointerEnter={() => showAt(i)}
              onPointerLeave={hide}
              onTouchStart={(e) => { e.preventDefault(); showAt(i); }}
              onTouchEnd={hide}
              style={{ cursor: "crosshair" }}
            >
              {/* Invisible hit area wider than the candle body */}
              <rect
                x={cx - bodyW}
                y={0}
                width={bodyW * 2}
                height={height}
                fill="transparent"
              />
              {/* Wick */}
              <line
                x1={cx}
                y1={toY(c.high)}
                x2={cx}
                y2={toY(c.low)}
                stroke={color}
                strokeWidth={isActive ? 1.5 : 1}
              />
              {/* Body */}
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={isUp ? color : "none"}
                stroke={color}
                strokeWidth={isActive ? 1.5 : 1}
                opacity={isActive ? 1 : 0.85}
              />
            </g>
          );
        })}
      </svg>

      {/* Keyboard-navigable overlay */}
      <div {...containerProps} className={CHART_FOCUS_OVERLAY_CLASS} />

      {/* Floating tooltip */}
      {isVisible && activeCandle && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded bg-slate-900/90 px-2 py-1 shadow-md"
          style={{
            left: Math.min(Math.max(0, tooltipX - 28), width - 60),
            top: Math.max(0, tooltipY - 44),
            whiteSpace: "nowrap",
            fontSize: 10,
            color: "white",
            transform: `translate(${tooltipOffset.x}px, ${tooltipOffset.y}px)`,
          }}
          aria-hidden="true"
        >
          <div>O {activeCandle.open.toFixed(4)}</div>
          <div>C {activeCandle.close.toFixed(4)}</div>
          <div>{formatPercentChange(activeCandle.close, activeCandle.open)}</div>
        </div>
      )}
    </div>
  );
}
