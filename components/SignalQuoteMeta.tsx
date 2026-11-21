"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Timestamp } from "@/components/Timestamp";
import type { Quote } from "@/lib/api-types.generated";

interface SignalQuoteMetaProps {
  quote: Quote;
  /** Pre-formatted quote price; null when the quote carries no price. */
  formattedPrice?: string | null;
}

const FRESHNESS_LABEL: Record<Quote["freshness"], string> = {
  fresh: "Fresh",
  stale: "Stale",
  unavailable: "Unavailable",
};

/**
 * #1038 — Quote source and freshness for a signal card.
 *
 * Shows the quote source, a human-readable last-updated time and a text label
 * for stale/unavailable data. Status is conveyed by text + icon (never colour
 * alone) and is not a live region, so it never interrupts screen readers.
 */
export function SignalQuoteMeta({ quote, formattedPrice }: SignalQuoteMetaProps) {
  const isFresh = quote.freshness === "fresh";
  const source = quote.source ?? "Source unavailable";
  const statusLabel = FRESHNESS_LABEL[quote.freshness] ?? "Unavailable";
  const StatusIcon = isFresh ? Info : AlertTriangle;

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground-muted"
      data-quote-freshness={quote.freshness}
    >
      <span className="font-medium text-foreground">Quote</span>
      {formattedPrice ? (
        <span className="font-mono">{formattedPrice}</span>
      ) : (
        <span>Price unavailable</span>
      )}
      <span aria-hidden="true">·</span>
      <span>
        Source: <span className="text-foreground">{source}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {quote.observedAt ? (
          <>
            Updated <Timestamp value={quote.observedAt} mode="relative" />
          </>
        ) : (
          "Update time unavailable"
        )}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 font-medium"
        title={isFresh ? "Quote is up to date" : "Quote may be out of date"}
      >
        <StatusIcon size={12} aria-hidden="true" />
        {statusLabel}
      </span>
    </div>
  );
}
