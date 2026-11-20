"use client";

import { useMemo } from "react";
import type { BacktestParams, BacktestResult } from "@/lib/backtest";
import { computeBuyAndHoldBaseline, excessReturnPoints } from "@/lib/backtestBaseline";

interface BacktestBaselineCardProps {
  params: BacktestParams;
  result: BacktestResult;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Strategy result next to a buy-and-hold baseline for the same period, or why none is available. */
export function BacktestBaselineCard({ params, result }: BacktestBaselineCardProps) {
  const baseline = useMemo(
    () => computeBuyAndHoldBaseline(params, result.priceHistory),
    [params, result.priceHistory]
  );

  return (
    <section aria-label="Buy-and-hold baseline" className="rounded border border-white/10 bg-white/5 p-3" data-testid="backtest-baseline">
      <h3 className="mb-2 text-sm font-semibold">Buy-and-hold baseline</h3>

      {baseline.status === "ok" ? (
        <>
          <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            <div className="rounded bg-white/5 p-2">
              <p className="mb-1 text-xs text-gray-400">Strategy return</p>
              <p className="text-lg font-semibold">{pct(result.totalReturn)}</p>
            </div>
            <div className="rounded bg-white/5 p-2">
              <p className="mb-1 text-xs text-gray-400">Buy-and-hold return</p>
              <p className="text-lg font-semibold">{pct(baseline.totalReturn)}</p>
              {baseline.endingValue !== undefined && (
                <p className="text-xs text-gray-400">Ends at {baseline.endingValue.toFixed(2)}</p>
              )}
            </div>
            <div className="rounded bg-white/5 p-2">
              <p className="mb-1 text-xs text-gray-400">Strategy vs baseline</p>
              <p className="text-lg font-semibold">
                {excessReturnPoints(result.totalReturn, baseline.totalReturn) >= 0 ? "+" : ""}
                {excessReturnPoints(result.totalReturn, baseline.totalReturn).toFixed(2)} pts
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Baseline bought at {baseline.startPrice} on {baseline.startTime} and sold at {baseline.endPrice} on{" "}
            {baseline.endTime}.
          </p>
        </>
      ) : (
        <p className="rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-300" role="status">
          {baseline.reason}
        </p>
      )}

      <details className="mt-3 text-xs text-gray-300">
        <summary className="cursor-pointer text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Baseline assumptions
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {baseline.assumptions.map((a) => (
            <div key={a.label} className="contents">
              <dt className="text-gray-400">{a.label}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-gray-500">The strategy's own assumptions are listed with the run's settings; they are not shared with the baseline.</p>
      </details>
    </section>
  );
}
