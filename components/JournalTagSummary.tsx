"use client";

import { useMemo, useState } from "react";
import { useTransactionStore } from "@/store/useTransactionStore";
import { summarizeByTag, UNTAGGED } from "@/lib/journalTagSummary";
import { cn } from "@/lib/utils";
import { PrivateValue } from "@/components/PrivateValue";

const PERIOD_OPTIONS = [
  { label: "7 days", value: "7", days: 7 },
  { label: "30 days", value: "30", days: 30 },
  { label: "All time", value: "ALL", days: null },
] as const;

export function JournalTagSummary() {
  const history = useTransactionStore((s) => s.history);
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("30");
  const [selected, setSelected] = useState<string[]>([]);

  const days = PERIOD_OPTIONS.find((o) => o.value === period)?.days ?? null;

  const allTags = useMemo(
    () => summarizeByTag(history, null).map((r) => r.tag).filter((t) => t !== UNTAGGED),
    [history]
  );
  const rows = useMemo(
    () => summarizeByTag(history, days === null ? null : Date.now() - days * 86_400_000, selected),
    [history, days, selected]
  );

  const toggle = (tag: string) =>
    setSelected((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">P&amp;L by Strategy Tag</h2>
        <select
          aria-label="Summary period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as typeof period)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selected.includes(tag)}
              onClick={() => toggle(tag)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                selected.includes(tag)
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-white/10 text-slate-400"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No journal entries in this period.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">Tag</th>
              <th className="py-2">Entries</th>
              <th className="py-2">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tag} className="border-t border-white/5 text-slate-200">
                <td className="py-2">{row.tag === UNTAGGED ? "Untagged" : row.tag}</td>
                <td className="py-2">{row.entryCount}</td>
                <td className="py-2">
                  {row.pnl === null ? (
                    <span className="text-slate-500">N/A</span>
                  ) : (
                    <span className={row.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                      <PrivateValue text="••••">{`${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)}`}</PrivateValue>
                    </span>
                  )}
                  {row.missingPnl > 0 && row.pnl !== null && (
                    <span className="ml-2 text-xs text-slate-500">
                      ({row.missingPnl} without P&amp;L)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
