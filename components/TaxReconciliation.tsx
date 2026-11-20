"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  applyDecisions,
  countByStatus,
  parseImportedRows,
  reconcileRows,
  type Decisions,
  type ImportedTaxRow,
  type MatchStatus,
} from "@/lib/taxReconciliation";
import type { TaxableTransaction } from "@/lib/taxUtils";

type Filter = "all" | MatchStatus;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "matched", label: "Matched" },
  { id: "unmatched", label: "Unmatched" },
  { id: "ambiguous", label: "Ambiguous" },
];

const STATUS_STYLE: Record<MatchStatus, string> = {
  matched: "bg-emerald-500/15 text-emerald-400",
  unmatched: "bg-red-500/15 text-red-400",
  ambiguous: "bg-amber-500/15 text-amber-400",
};

interface TaxReconciliationProps {
  transactions: readonly TaxableTransaction[];
}

/** Compare imported tax rows (CSV) with recognized transactions and resolve unmatched or ambiguous ones. */
export function TaxReconciliation({ transactions }: TaxReconciliationProps) {
  const [rows, setRows] = useState<ImportedTaxRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [filter, setFilter] = useState<Filter>("all");

  const reconciled = useMemo(() => applyDecisions(reconcileRows(rows, transactions), decisions), [rows, transactions, decisions]);
  const counts = useMemo(() => countByStatus(reconciled), [reconciled]);
  const visible = filter === "all" ? reconciled : reconciled.filter((r) => r.status === filter);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setReadError(null);
    try {
      const text = await file.text();
      const parsed = parseImportedRows(text);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setDecisions({});
      setFilter("all");
      setFileName(file.name);
    } catch (err) {
      setReadError(err instanceof Error ? `Could not read the file: ${err.message}` : "Could not read the file.");
    } finally {
      setReading(false);
    }
  }

  const confirm = (rowId: string, transactionId: string) =>
    setDecisions((prev) => ({ ...prev, [rowId]: { ...prev[rowId], confirmed: transactionId } }));
  const dismiss = (rowId: string, transactionId: string) =>
    setDecisions((prev) => ({
      ...prev,
      [rowId]: {
        confirmed: prev[rowId]?.confirmed === transactionId ? undefined : prev[rowId]?.confirmed,
        dismissed: [...(prev[rowId]?.dismissed ?? []), transactionId],
      },
    }));

  return (
    <Card data-testid="tax-reconciliation">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Reconcile imported rows</h3>
        <p className="text-xs text-foreground-muted">
          Load a CSV with Date, Asset Pair and Amount columns (and optionally a transaction hash) to compare it with your recognized
          transactions. Nothing is changed in your report.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-foreground-muted">
            <span className="sr-only">Choose a CSV file of imported tax rows</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={reading}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="text-xs file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
            />
          </label>
          {reading && (
            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted" role="status">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Reading file…
            </span>
          )}
        </div>

        {readError && (
          <p role="alert" className="text-xs text-red-400">
            {readError}
          </p>
        )}
        {errors.length > 0 && (
          <div role="alert" className="rounded bg-red-500/10 p-2 text-xs text-red-300">
            <p className="font-medium">
              {errors.length} problem{errors.length === 1 ? "" : "s"} in {fileName}; those rows were not reconciled:
            </p>
            <ul className="mt-1 list-disc pl-4">
              {errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 10 && <li>…and {errors.length - 10} more</li>}
            </ul>
          </div>
        )}

        {fileName === null && !readError ? (
          <p className="text-xs text-foreground-muted">No file loaded yet.</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-foreground-muted" role="status">
            No importable rows were found{fileName ? ` in ${fileName}` : ""}.
          </p>
        ) : (
          <>
            <div role="group" aria-label="Filter rows by match status" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const n = f.id === "all" ? reconciled.length : counts[f.id];
                return (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={filter === f.id ? "default" : "outline"}
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label} ({n})
                  </Button>
                );
              })}
            </div>
            <p className="sr-only" aria-live="polite">
              {visible.length} row{visible.length === 1 ? "" : "s"} shown.
            </p>
            {visible.length === 0 ? (
              <p className="text-xs text-foreground-muted">No rows with this status.</p>
            ) : (
              <ul className="space-y-2">
                {visible.map((item) => (
                  <li key={item.row.rowId} className="rounded border border-border/60 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-foreground-muted">Row {item.row.rowId}</span>
                      <span>{item.row.date}</span>
                      <span className="font-mono font-medium text-foreground">{item.row.assetPair}</span>
                      <span>{item.row.amount}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_STYLE[item.status])}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-foreground-muted">{item.reason}</p>
                    {item.status !== "matched" || item.basis !== "confirmed" ? (
                      <ul className="mt-1 space-y-1">
                        {item.candidates.map((c) => (
                          <li key={c.transactionId} className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px]">{c.label}</span>
                            {item.status !== "matched" && (
                              <Button size="sm" variant="outline" onClick={() => confirm(item.row.rowId, c.transactionId)}>
                                Confirm match
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => dismiss(item.row.rowId, c.transactionId)}>
                              Dismiss
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
