"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildLineItemSources, summarizeSources } from "@/lib/taxLineSources";
import type { TaxEntry, TaxableTransaction } from "@/lib/taxUtils";

const INITIAL_VISIBLE = 50;

interface TaxLineItemSourcesProps {
  entries: readonly TaxEntry[];
  transactionsById: ReadonlyMap<string, TaxableTransaction>;
}

/** Audit view: each report line with the transaction record behind it and its receipt link. */
export function TaxLineItemSources({ entries, transactionsById }: TaxLineItemSourcesProps) {
  const items = useMemo(
    () => buildLineItemSources(entries, transactionsById, process.env.NEXT_PUBLIC_STELLAR_NETWORK),
    [entries, transactionsById]
  );
  const summary = useMemo(() => summarizeSources(items), [items]);
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const unlinked = summary.partial + summary.missing;

  return (
    <Card data-testid="tax-line-sources">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Line-item sources</h3>
        <p className="text-xs text-foreground-muted">
          {summary.total} line item{summary.total === 1 ? "" : "s"}, {summary.linked} with an on-chain source
          {unlinked > 0 ? `, ${unlinked} without one` : ""}. Totals include every line.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {unlinked > 0 && (
          <p className="rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300" role="status">
            {unlinked} line item{unlinked === 1 ? " has" : "s have"} no linked on-chain transaction. They are still counted in the report totals.
          </p>
        )}
        {visible.map((item) => (
          <details key={item.entryId} className="rounded border border-border/60 px-3 py-2 text-xs">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-foreground-muted">{item.date}</span>
              <span className="font-mono font-medium text-foreground">{item.assetPair}</span>
              <span className={cn("font-medium", item.gainLoss >= 0 ? "text-green-400" : "text-red-400")}>
                {item.gainLoss >= 0 ? "+" : ""}${item.gainLoss.toFixed(2)}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  item.status === "linked" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                )}
              >
                {item.status === "linked" ? "Source linked" : item.status === "partial" ? "No receipt" : "Source missing"}
              </span>
            </summary>
            <div className="mt-2 space-y-1 pl-1">
              {item.reason && <p className="text-amber-300">{item.reason}</p>}
              {item.sources.map((source) => (
                <div key={source.transactionId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-foreground-muted">Transaction {source.transactionId}</span>
                  {source.type && <span className="text-foreground-muted">{source.type.replace("_", " ")}</span>}
                  {source.hash && <span className="font-mono">{`${source.hash.slice(0, 8)}…${source.hash.slice(-6)}`}</span>}
                  {source.receiptUrl && (
                    <a
                      href={source.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Receipt <ArrowRight size={11} aria-hidden="true" />
                    </a>
                  )}
                  <Link href="/journal" className="text-sky-400 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Open journal
                  </Link>
                </div>
              ))}
            </div>
          </details>
        ))}
        {items.length > INITIAL_VISIBLE && !showAll && (
          <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>
            Show all {items.length} line items
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
