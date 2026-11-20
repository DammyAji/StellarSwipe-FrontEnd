"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  conversionSummaryText,
  describeConversion,
  summarizeConversions,
  type ConversionDetail,
} from "@/lib/taxConversionDetails";
import type { TaxEntry } from "@/lib/taxUtils";

function Value({ text, available }: { text: string; available: boolean }) {
  return <span className={cn(!available && "italic text-foreground-subtle")}>{text}</span>;
}

/**
 * Shows, for every converted report line, the rate, where it came from and when it
 * was looked up, next to the transaction time. Missing metadata is marked
 * "Unavailable" instead of being filled in.
 */
export function TaxConversionRateDetails({ entries }: { entries: readonly TaxEntry[] }) {
  const details = useMemo(
    () => entries.map(describeConversion).filter((d): d is ConversionDetail => d !== null),
    [entries]
  );
  const summary = useMemo(() => summarizeConversions(entries), [entries]);
  if (details.length === 0) return null;

  return (
    <Card data-testid="tax-conversion-details">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Conversion rates</h3>
        <p className="text-xs text-foreground-muted">{conversionSummaryText(summary)}</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Conversion rate details">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="pb-2 pr-4 text-left font-medium">Pair</th>
                <th className="pb-2 pr-4 text-left font-medium">Transaction time</th>
                <th className="pb-2 pr-4 text-left font-medium">Rate</th>
                <th className="pb-2 pr-4 text-left font-medium">Rate source</th>
                <th className="pb-2 text-left font-medium">Rate looked up</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.entryId} className="border-b border-border/50 align-top last:border-0">
                  <td className="py-2 pr-4 font-mono">
                    {d.assetPair} <span className="text-foreground-muted">({d.currency})</span>
                  </td>
                  <td className="py-2 pr-4 text-foreground-muted">{d.transactionTime}</td>
                  <td className="py-2 pr-4 font-mono">
                    <Value text={d.rate} available={d.rateAvailable} />
                  </td>
                  <td className="py-2 pr-4">
                    <Value text={d.source} available={d.sourceAvailable} />
                  </td>
                  <td className="py-2">
                    <Value text={d.lookedUpAt} available={d.lookupAvailable} />
                    {d.timingNote && <p className="text-[11px] text-foreground-subtle">{d.timingNote}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
