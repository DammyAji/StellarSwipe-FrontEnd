"use client";

import { useMemo } from "react";
import type { BacktestParams } from "@/lib/backtest";
import { buildConfigSnapshot } from "@/lib/backtestSnapshot";

interface BacktestConfigSnapshotProps {
  run: { id: string; timestamp: number; params: Partial<BacktestParams> | undefined };
}

/** Read-only copy of the inputs saved with a run; incomplete older runs are marked partial. */
export function BacktestConfigSnapshot({ run }: BacktestConfigSnapshotProps) {
  const snapshot = useMemo(() => buildConfigSnapshot(run), [run]);

  return (
    <section aria-label="Configuration snapshot" className="mb-6 rounded border border-white/10 bg-white/5 p-3" data-testid="backtest-config-snapshot">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-xs uppercase tracking-wide text-gray-400">Configuration snapshot (read-only)</h2>
        <span
          className={
            snapshot.partial
              ? "rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300"
              : "rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300"
          }
        >
          {snapshot.partial ? "Partial" : "Complete"}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {snapshot.rows.map((row) => (
          <div key={row.key}>
            <dt className="text-xs text-gray-400">{row.label}</dt>
            <dd className={row.captured ? "font-semibold" : "italic text-gray-500"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {snapshot.partial && (
        <p className="mt-3 text-xs text-amber-300" role="status">
          This run was saved before these inputs were recorded: {snapshot.missing.join(", ")}. They are shown as not
          captured rather than filled with current defaults.
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">Captured when the run was saved on {new Date(snapshot.capturedAt).toLocaleString()}.</p>
    </section>
  );
}
