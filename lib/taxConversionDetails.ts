import type { TaxEntry } from "@/lib/taxUtils";

export const UNAVAILABLE = "Unavailable";

export interface ConversionDetail {
  entryId: string;
  assetPair: string;
  currency: string;
  /** Transaction time and rate lookup time are separate on purpose; either may be unavailable. */
  transactionTime: string;
  rate: string;
  rateAvailable: boolean;
  source: string;
  sourceAvailable: boolean;
  lookedUpAt: string;
  lookupAvailable: boolean;
  /** How far the lookup was from the transaction, when both times are known. */
  timingNote: string | null;
}

export interface ConversionSummary {
  converted: number;
  missingRate: number;
  missingSource: number;
  missingLookupTime: number;
}

function utc(timestamp: number): string {
  return `${new Date(timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function validTimestamp(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Number.isNaN(new Date(value).getTime());
}

function formatDelta(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

/** Conversion context for one report line; null when the line was not converted. */
export function describeConversion(entry: TaxEntry): ConversionDetail | null {
  if (!entry.foreignCurrency) return null;
  const rateAvailable = typeof entry.conversionRate === "number" && Number.isFinite(entry.conversionRate) && entry.conversionRate > 0;
  const source = (entry.conversionRateSource ?? "").trim();
  const lookupAvailable = validTimestamp(entry.conversionRateLookupTimestamp);
  const txTime = entry.date.getTime();

  let timingNote: string | null = null;
  if (lookupAvailable && validTimestamp(txTime)) {
    const delta = (entry.conversionRateLookupTimestamp as number) - txTime;
    timingNote =
      Math.abs(delta) < 60_000
        ? "Rate looked up at the transaction time."
        : `Rate looked up ${formatDelta(Math.abs(delta))} ${delta < 0 ? "before" : "after"} the transaction.`;
  }

  return {
    entryId: entry.id,
    assetPair: entry.assetPair,
    currency: entry.foreignCurrency,
    transactionTime: validTimestamp(txTime) ? utc(txTime) : UNAVAILABLE,
    rate: rateAvailable ? (entry.conversionRate as number).toFixed(6) : UNAVAILABLE,
    rateAvailable,
    source: source || UNAVAILABLE,
    sourceAvailable: source.length > 0,
    lookedUpAt: lookupAvailable ? utc(entry.conversionRateLookupTimestamp as number) : UNAVAILABLE,
    lookupAvailable,
    timingNote,
  };
}

export function summarizeConversions(entries: readonly TaxEntry[]): ConversionSummary {
  const details = entries.map(describeConversion).filter((d): d is ConversionDetail => d !== null);
  return {
    converted: details.length,
    missingRate: details.filter((d) => !d.rateAvailable).length,
    missingSource: details.filter((d) => !d.sourceAvailable).length,
    missingLookupTime: details.filter((d) => !d.lookupAvailable).length,
  };
}

/** One-line description of how complete the conversion metadata is, for export previews. */
export function conversionSummaryText(summary: ConversionSummary): string {
  if (summary.converted === 0) return "No converted entries";
  const complete = summary.converted - Math.max(summary.missingSource, summary.missingLookupTime, summary.missingRate);
  if (summary.missingSource === 0 && summary.missingLookupTime === 0 && summary.missingRate === 0) {
    return `${summary.converted} converted, all with rate, source and lookup time`;
  }
  return `${summary.converted} converted: ${summary.missingSource} without a rate source, ${summary.missingLookupTime} without a lookup time (${Math.max(0, complete)} complete)`;
}
