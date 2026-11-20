import { getExplorerTxUrl } from "@/lib/stellar/explorer";
import type { TaxEntry, TaxableTransaction } from "@/lib/taxUtils";

/** Hash prefixes the journal uses for records that are not on-chain transactions. */
const OFF_CHAIN_PREFIXES = ["manual-", "csv-"] as const;

export function hasReceiptHash(hash: string | undefined): hash is string {
  const value = (hash ?? "").trim();
  return value.length >= 16 && !OFF_CHAIN_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export interface LineSource {
  transactionId: string;
  type: string | null;
  hash: string | null;
  /** Explorer receipt for an on-chain transaction; null when none exists. */
  receiptUrl: string | null;
}

export type SourceStatus = "linked" | "partial" | "missing";

export interface LineItemSources {
  entryId: string;
  assetPair: string;
  date: string;
  gainLoss: number;
  sources: LineSource[];
  status: SourceStatus;
  /** Why the line is not fully linked; null when it is. */
  reason: string | null;
}

export interface SourceSummary {
  total: number;
  linked: number;
  partial: number;
  missing: number;
  /** Sum over all lines; equals the report total because no line is ever hidden. */
  totalGainLoss: number;
}

/**
 * Lists the transaction record that contributed to each report line. Every line
 * is returned, including those whose source is missing, so totals still add up
 * and the gap is visible instead of being hidden.
 */
export function buildLineItemSources(
  entries: readonly TaxEntry[],
  transactionsById: ReadonlyMap<string, TaxableTransaction>,
  network?: string | null
): LineItemSources[] {
  return entries.map((entry) => {
    const tx = transactionsById.get(entry.id);
    const base = {
      entryId: entry.id,
      assetPair: entry.assetPair,
      date: entry.date.toISOString().split("T")[0],
      gainLoss: entry.gainLoss,
    };
    if (!tx) {
      return { ...base, sources: [], status: "missing" as const, reason: "The source transaction record could not be found." };
    }
    const hash = tx.source?.hash;
    const receipt = hasReceiptHash(hash);
    const source: LineSource = {
      transactionId: tx.id,
      type: tx.source?.type ?? null,
      hash: receipt ? hash : null,
      receiptUrl: receipt ? getExplorerTxUrl(hash, network) : null,
    };
    return receipt
      ? { ...base, sources: [source], status: "linked" as const, reason: null }
      : {
          ...base,
          sources: [source],
          status: "partial" as const,
          reason: "This record has no on-chain transaction hash (it was entered or imported manually), so there is no receipt to link.",
        };
  });
}

export function summarizeSources(items: readonly LineItemSources[]): SourceSummary {
  return {
    total: items.length,
    linked: items.filter((i) => i.status === "linked").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
    totalGainLoss: items.reduce((sum, i) => sum + i.gainLoss, 0),
  };
}
