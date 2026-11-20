"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { diffRevisions, hasComparableHistory, TRACKED_FIELDS } from "@/lib/journalRevisions";
import { useJournalRevisionStore } from "@/store/useJournalRevisionStore";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

interface JournalRevisionCompareProps {
  entry: TransactionHistoryItem | null;
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/** Side-by-side comparison of two saved versions of an entry. */
export function JournalRevisionCompare({ entry, onClose }: JournalRevisionCompareProps) {
  const revisions = useJournalRevisionStore((state) => (entry ? state.revisions[entry.id] : undefined));
  const comparable = hasComparableHistory(revisions);
  const count = revisions?.length ?? 0;
  const [leftVersion, setLeftVersion] = useState(0);
  const [rightVersion, setRightVersion] = useState(0);

  // Default to the two most recent versions whenever the entry or its history changes.
  useEffect(() => {
    if (!revisions || revisions.length < 2) return;
    setLeftVersion(revisions[revisions.length - 2].version);
    setRightVersion(revisions[revisions.length - 1].version);
  }, [entry?.id, revisions]);

  const left = revisions?.find((r) => r.version === leftVersion);
  const right = revisions?.find((r) => r.version === rightVersion);
  const changes = useMemo(() => (left && right ? diffRevisions(left, right) : []), [left, right]);

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-3xl border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{entry ? `${entry.assetPair} revision history` : "Revision history"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Versions are recorded on this device while the journal is open. The first version is the state when it was
            first seen here.
          </DialogDescription>
        </DialogHeader>

        {!comparable ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300" role="status">
            {count === 0
              ? "No history has been recorded for this entry yet."
              : "No earlier versions have been saved for this entry. Edits you make from now on will appear here."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ["Earlier version", leftVersion, setLeftVersion, "journal-revision-left"],
                ["Later version", rightVersion, setRightVersion, "journal-revision-right"],
              ] as const).map(([label, value, setValue, id]) => (
                <div key={id} className="space-y-1">
                  <label htmlFor={id} className="text-xs font-medium text-slate-400">
                    {label}
                  </label>
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {revisions?.map((r) => (
                      <option key={r.version} value={r.version}>
                        {`v${r.version} · ${formatTime(r.capturedAt)}${r.source === "baseline" ? " (first seen)" : ""}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {left && right && leftVersion === rightVersion ? (
              <p className="text-sm text-slate-400" role="status">
                Choose two different versions to compare.
              </p>
            ) : changes.length === 0 ? (
              <p className="text-sm text-slate-400" role="status">
                These versions have identical values.
              </p>
            ) : (
              <table className="w-full text-left text-sm" aria-label="Changed fields">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-3">Field</th>
                    <th className="pb-2 pr-3">{left ? formatTime(left.capturedAt) : ""}</th>
                    <th className="pb-2">{right ? formatTime(right.capturedAt) : ""}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field} className="border-t border-white/5 align-top">
                      <th scope="row" className="py-2 pr-3 font-medium text-slate-300">
                        {c.label}
                      </th>
                      <td className="py-2 pr-3 text-red-300">{c.before || "—"}</td>
                      <td className="py-2 text-emerald-300">{c.after || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {left && right && leftVersion !== rightVersion && changes.length > 0 && (
              <p className="text-xs text-slate-500">
                {TRACKED_FIELDS.length - changes.length} unchanged field
                {TRACKED_FIELDS.length - changes.length === 1 ? "" : "s"} not shown.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
