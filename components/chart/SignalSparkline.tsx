"use client";

import { BarChart2, LineChart } from "lucide-react";
import { MiniChart } from "./MiniChart";
import { CandlestickChart } from "./CandlestickChart";
import { useChartStyleStore } from "@/store/useChartStyleStore";
import { useDataSaverStore } from "@/store/useDataSaverStore";
import { shouldRenderMiniChart } from "@/lib/dataSaver";
import { cn } from "@/lib/utils";

interface SignalSparklineProps {
  /** ROI series rendered as a line or candlestick sparkline. */
  data: number[];
  className?: string;
}

/**
 * Sparkline region of a SignalCard.
 *
 * When Data Saver mode (issue #408) is enabled the mini chart is *not*
 * rendered — it is replaced with a lightweight static placeholder and the
 * chart-style toggle is omitted, avoiding the per-card chart-rendering work.
 * When disabled, the full line / candlestick chart and its style toggle render
 * as before, restoring functionality immediately without a reload.
 */
export function SignalSparkline({ data, className }: SignalSparklineProps) {
  const { chartStyle, setChartStyle } = useChartStyleStore();
  const dataSaverEnabled = useDataSaverStore((s) => s.dataSaverEnabled);

  // #684: a line/candlestick chart needs at least two points to show a trend.
  // Surface a clear, styled explanation instead of silently rendering nothing.
  if (data.length < 2) {
    const isEmpty = data.length === 0;
    return (
      <div
        role="status"
        aria-label={
          isEmpty
            ? "No price data is available for this asset yet. Check back once trading activity begins."
            : "This asset needs a bit more price history before a chart can be shown."
        }
        data-testid="chart-unavailable-placeholder"
        className={cn(
          "flex h-10 flex-1 items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 px-2 text-center text-[11px] text-foreground-muted",
          className
        )}
      >
        <span aria-hidden="true">
          {isEmpty ? "No chart data yet" : "Not enough history yet"}
        </span>
        <span className="sr-only">
          {isEmpty
            ? "Check back once this asset has recorded price history."
            : "Check back once more price history has accumulated."}
        </span>
      </div>
    );
  }

  if (!shouldRenderMiniChart(dataSaverEnabled)) {
    return (
      <div
        role="img"
        aria-label="Mini chart hidden to save data"
        data-testid="data-saver-chart-placeholder"
        className={cn(
          "flex h-10 flex-1 items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 px-2 text-[11px] text-foreground-muted",
          className
        )}
      >
        Chart hidden · Data Saver
      </div>
    );
  }

  return (
    <>
      {chartStyle === "candlestick" ? (
        <CandlestickChart data={data} className={cn("flex-1", className)} />
      ) : (
        <MiniChart data={data} className={cn("flex-1", className)} />
      )}
      <button
        type="button"
        onClick={() =>
          setChartStyle(chartStyle === "line" ? "candlestick" : "line")
        }
        aria-label={`Switch to ${
          chartStyle === "line" ? "candlestick" : "line"
        } chart`}
        aria-pressed={chartStyle === "candlestick"}
        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {chartStyle === "line" ? (
          <BarChart2 size={14} aria-hidden="true" />
        ) : (
          <LineChart size={14} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
