"use client";

import { useMemo, useRef } from "react";
import type { BacktestResult } from "@/lib/backtest";
import { findMaxDrawdownInterval, type DrawdownPoint } from "@/lib/backtestDrawdown";

const WIDTH = 600;
const HEIGHT = 160;
const PAD = 12;

interface BacktestDrawdownInspectorProps {
  result: BacktestResult;
}

function formatEquity(value: number): string {
  return value.toFixed(2);
}

/** Jump from the max-drawdown metric to its interval on the equity curve. */
export function BacktestDrawdownInspector({ result }: BacktestDrawdownInspectorProps) {
  const figureRef = useRef<HTMLElement>(null);
  const interval = useMemo(
    () => findMaxDrawdownInterval(result.equityCurve, result.maxDrawdown),
    [result.equityCurve, result.maxDrawdown]
  );
  const curve = result.equityCurve ?? [];

  const geometry = useMemo(() => {
    if (curve.length < 2) return null;
    const values = curve.map((p) => p.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (i: number) => PAD + (i / (curve.length - 1)) * (WIDTH - 2 * PAD);
    const y = (v: number) => HEIGHT - PAD - ((v - min) / span) * (HEIGHT - 2 * PAD);
    return { x, y, points: curve.map((p, i) => `${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(" ") };
  }, [curve]);

  function jumpToInterval() {
    figureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    figureRef.current?.focus();
  }

  const markers: Array<{ name: string; point: DrawdownPoint | null }> =
    interval.status === "ok"
      ? [
          { name: "Peak", point: interval.peak },
          { name: "Trough", point: interval.trough },
          { name: "Recovery", point: interval.recovery },
        ]
      : [];

  return (
    <section aria-label="Worst drawdown interval" className="rounded border border-white/10 bg-white/5 p-3" data-testid="backtest-drawdown">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Worst drawdown interval</h3>
        {interval.status === "ok" && (
          <button
            type="button"
            onClick={jumpToInterval}
            className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Inspect on the equity curve
          </button>
        )}
      </div>

      {interval.status === "unavailable" && (
        <p className="rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-300" role="status">
          {interval.reason}
        </p>
      )}
      {interval.status === "none" && (
        <p className="text-sm text-gray-300" role="status">
          No drawdown to inspect. {interval.notes.join(" ")}
        </p>
      )}

      {interval.status === "ok" && geometry && (
        <>
          <figure
            ref={figureRef}
            tabIndex={-1}
            aria-label={`Equity curve. Worst drawdown ${(interval.depth * 100).toFixed(2)} percent from ${interval.peak.time} to ${interval.trough.time}${interval.recovery ? `, recovered ${interval.recovery.time}` : ", not recovered"}.`}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-40 w-full" aria-hidden="true">
              <rect
                x={geometry.x(interval.peak.index)}
                y={0}
                width={Math.max(2, geometry.x(interval.recovery?.index ?? curve.length - 1) - geometry.x(interval.peak.index))}
                height={HEIGHT}
                className="fill-red-500/15"
              />
              <polyline points={geometry.points} fill="none" strokeWidth={1.5} className="stroke-sky-400" />
              <circle cx={geometry.x(interval.peak.index)} cy={geometry.y(interval.peak.equity)} r={4} className="fill-emerald-400" />
              <rect
                x={geometry.x(interval.trough.index) - 4}
                y={geometry.y(interval.trough.equity) - 4}
                width={8}
                height={8}
                className="fill-red-400"
              />
              {interval.recovery && (
                <polygon
                  points={`${geometry.x(interval.recovery.index)},${geometry.y(interval.recovery.equity) - 5} ${geometry.x(interval.recovery.index) - 5},${geometry.y(interval.recovery.equity) + 4} ${geometry.x(interval.recovery.index) + 5},${geometry.y(interval.recovery.equity) + 4}`}
                  className="fill-amber-300"
                />
              )}
            </svg>
            <figcaption className="text-xs text-gray-400">
              Shaded area: from the peak (circle) through the trough (square){interval.recovery ? " to the recovery (triangle)" : " to the end of the recorded period"}.
            </figcaption>
          </figure>

          <table className="mt-3 w-full text-left text-sm" aria-label="Drawdown interval values">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400">
                <th className="pb-1 pr-3">Point</th>
                <th className="pb-1 pr-3">Time</th>
                <th className="pb-1">Equity</th>
              </tr>
            </thead>
            <tbody>
              {markers.map(({ name, point }) => (
                <tr key={name} className="border-b border-white/5">
                  <th scope="row" className="py-1 pr-3 font-medium">{name}</th>
                  <td className="py-1 pr-3">{point ? point.time : "Not reached"}</td>
                  <td className="py-1">{point ? formatEquity(point.equity) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-400">Depth: {(interval.depth * 100).toFixed(2)}% peak to trough.</p>
          {interval.notes.map((note) => (
            <p key={note} className="mt-1 text-xs text-amber-300" role="status">
              {note}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
