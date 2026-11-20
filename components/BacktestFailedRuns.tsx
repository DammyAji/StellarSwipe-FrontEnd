"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { retryEligibility } from "@/lib/backtestRetry";
import { useBacktestFailedRunsStore } from "@/store/useBacktestFailedRunsStore";

/** Failed simulations with a one-click retry that restores the saved inputs. */
export function BacktestFailedRuns() {
  const failures = useBacktestFailedRunsStore((state) => state.failures);
  const removeFailure = useBacktestFailedRunsStore((state) => state.removeFailure);

  if (failures.length === 0) return null;

  return (
    <section aria-label="Failed simulations" className="mb-6 rounded border border-red-500/20 bg-red-500/5 p-3" data-testid="backtest-failed-runs">
      <h2 className="mb-2 text-sm font-semibold text-red-300">Failed simulations ({failures.length})</h2>
      <ul className="space-y-2">
        {failures.map((failure) => {
          const { eligible, reason } = retryEligibility(failure);
          return (
            <li key={failure.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/5 p-2 text-sm">
              <div>
                <p className="font-medium">
                  {failure.params.from} → {failure.params.to}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(failure.timestamp).toLocaleString()} · {failure.error}
                </p>
                {!eligible && <p className="text-xs text-amber-300">Cannot retry: {reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                {eligible && (
                  <Link href={`/backtest-sim?retry=${encodeURIComponent(failure.id)}`}>
                    <Button size="sm" variant="outline">
                      Retry with saved settings
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={() => removeFailure(failure.id)} aria-label={`Dismiss failed run from ${failure.params.from}`}>
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
