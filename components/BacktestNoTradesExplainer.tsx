"use client";

import { useMemo } from "react";
import type { BacktestParams, BacktestResult } from "@/lib/backtest";
import { explainNoTrades } from "@/lib/backtestNoTrades";

interface BacktestNoTradesExplainerProps {
  params: Partial<BacktestParams> | undefined;
  result: Pick<BacktestResult, "trades"> | undefined;
  /**
   * Where input links point. Empty on the simulator page itself (in-page anchors);
   * `/backtest-sim` when shown elsewhere, such as a saved run's detail page.
   */
  inputsHref?: string;
}

/** Shown for completed simulations with no trades: known input constraints and what is unknown. */
export function BacktestNoTradesExplainer({ params, result, inputsHref = "" }: BacktestNoTradesExplainerProps) {
  const explanation = useMemo(() => explainNoTrades(params, result), [params, result]);
  if (!explanation.applicable) return null;

  return (
    <section
      aria-label="Why there are no trades"
      className="rounded border border-white/10 bg-white/5 p-3 text-sm"
      data-testid="backtest-no-trades"
    >
      <h3 className="mb-2 font-semibold">This simulation produced no trades</h3>
      {explanation.constraints.length > 0 ? (
        <>
          <p className="mb-1 text-xs text-gray-400">Known constraints from this run's inputs:</p>
          <ul className="list-disc space-y-1 pl-5">
            {explanation.constraints.map((c) => (
              <li key={c.id}>
                {c.message}{" "}
                <a
                  href={`${inputsHref}#${c.inputId}`}
                  className="text-sky-400 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Go to {c.inputLabel}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-gray-300">No input constraints that would prevent trading were found in this run's settings.</p>
      )}
      <p className="mt-2 text-xs text-gray-400">{explanation.unknownNote}</p>
    </section>
  );
}
