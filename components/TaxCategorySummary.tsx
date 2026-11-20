"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { summarizeByCategory } from "@/lib/taxCategorySummary";
import type { CategoryAssignments } from "@/lib/taxCategorization";
import type { TaxReport, TaxableTransaction } from "@/lib/taxUtils";

interface TaxCategorySummaryProps {
  report: TaxReport;
  transactionsById: ReadonlyMap<string, TaxableTransaction>;
  assignments: CategoryAssignments;
}

const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;

/** Report composition by tax category; every line is counted once and unsupported rows stay visible. */
export function TaxCategorySummary({ report, transactionsById, assignments }: TaxCategorySummaryProps) {
  const summary = useMemo(
    () => summarizeByCategory(report.entries, transactionsById, assignments, report.totalGainLoss),
    [report.entries, report.totalGainLoss, transactionsById, assignments]
  );

  if (summary.groups.length === 0) {
    return (
      <Card data-testid="tax-category-summary">
        <CardHeader>
          <h3 className="text-sm font-semibold text-foreground">Summary by category</h3>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-foreground-muted">No report lines to summarize for this year.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="tax-category-summary">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Summary by category</h3>
        <p className="text-xs text-foreground-muted">Open a category to see the lines that make it up.</p>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {summary.groups.map((group) => (
          <details key={group.category} className="rounded border border-border/60 px-3 py-2 text-xs">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className={cn("font-medium", group.category === "uncategorized" ? "text-amber-400" : "text-foreground")}>
                {group.label}
              </span>
              <span className="text-foreground-muted">
                {group.count} line{group.count === 1 ? "" : "s"} · proceeds {money(group.proceeds)} · cost basis{" "}
                {money(group.costBasis)} ·{" "}
                <span className={group.gainLoss >= 0 ? "text-green-400" : "text-red-400"}>
                  {group.gainLoss >= 0 ? "+" : ""}
                  {money(group.gainLoss)}
                </span>
              </span>
            </summary>
            {group.category === "uncategorized" && (
              <p className="mt-2 text-amber-300">
                These lines have an unsupported or unresolved category. They are still included in the report totals.
              </p>
            )}
            <ul className="mt-2 space-y-1">
              {group.lines.map((line) => (
                <li key={line.id} className="flex flex-wrap justify-between gap-2 text-foreground-muted">
                  <span>
                    {line.date.toISOString().split("T")[0]} · <span className="font-mono text-foreground">{line.assetPair}</span>
                  </span>
                  <span className={line.gainLoss >= 0 ? "text-green-400" : "text-red-400"}>
                    {line.gainLoss >= 0 ? "+" : ""}
                    {money(line.gainLoss)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
        <p
          className={cn("text-xs", summary.reconciles ? "text-foreground-muted" : "text-red-400")}
          role="status"
          data-testid="tax-category-reconciliation"
        >
          {summary.reconciles
            ? `Totals reconcile to the report: ${summary.totals.count} lines, net ${money(summary.totals.gainLoss)}.`
            : `Category totals differ from the report by ${money(summary.gainLossDifference)}. Please review the lines above.`}
        </p>
      </CardContent>
    </Card>
  );
}
