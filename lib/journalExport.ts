import type { TransactionHistoryItem } from "@/store/useTransactionStore";

export const JOURNAL_EXPORT_SCHEMA = "stellarswipe.journal.export";
export const JOURNAL_EXPORT_VERSION = 1;

export interface JournalExportFieldDoc {
  name: string;
  type: string;
  description: string;
  /** False when the field is omitted for entries that do not have it. */
  required: boolean;
}

/** Documented fields of each exported entry; the file embeds this list. */
export const JOURNAL_EXPORT_FIELDS: readonly JournalExportFieldDoc[] = [
  { name: "id", type: "string", description: "Journal entry id.", required: true },
  { name: "hash", type: "string", description: "Transaction hash, or a placeholder (manual-/csv-) for entries not linked to a transaction.", required: true },
  { name: "assetPair", type: "string", description: "Traded pair, e.g. XLM/USDC.", required: true },
  { name: "type", type: "string", description: "COPY_TRADE, SWAP or MANUAL.", required: true },
  { name: "status", type: "string", description: "PENDING, SUCCEEDED or FAILED.", required: true },
  { name: "outcome", type: "string", description: "WIN, LOSS or PENDING.", required: true },
  { name: "token", type: "string", description: "Token symbol of the amount.", required: true },
  { name: "amount", type: "string", description: "Traded amount as entered (decimal string).", required: true },
  { name: "price", type: "string", description: "Price as entered (decimal string).", required: true },
  { name: "fee", type: "string", description: "Fee as entered (decimal string).", required: true },
  { name: "timestamp", type: "string", description: "Entry time as an ISO 8601 UTC string.", required: true },
  { name: "archived", type: "boolean", description: "True when the entry is archived.", required: true },
  { name: "tags", type: "string[]", description: "Normalized tags.", required: true },
  { name: "network", type: "string", description: "TESTNET or PUBLIC, when recorded.", required: false },
  { name: "notes", type: "string", description: "The user's notes, when present.", required: false },
  { name: "pnl", type: "number", description: "Realized profit/loss in quote currency, when known.", required: false },
  { name: "walletAddress", type: "string", description: "Stellar account the entry was made from, when known.", required: false },
] as const;

export interface JournalExportEntry {
  id: string;
  hash: string;
  assetPair: string;
  type: string;
  status: string;
  outcome: string;
  token: string;
  amount: string;
  price: string;
  fee: string;
  timestamp: string;
  archived: boolean;
  tags: string[];
  network?: string;
  notes?: string;
  pnl?: number;
  walletAddress?: string;
}

export interface JournalExportDocument {
  schema: typeof JOURNAL_EXPORT_SCHEMA;
  version: typeof JOURNAL_EXPORT_VERSION;
  exportedAt: string;
  count: number;
  fields: readonly JournalExportFieldDoc[];
  entries: JournalExportEntry[];
}

export type JournalExportResult =
  | { ok: true; json: string; filename: string; count: number }
  | { ok: false; reason: "empty-selection" | "generation-failed"; message: string };

export type JournalExportDownloadResult =
  | { ok: true; filename: string; count: number }
  | {
      ok: false;
      reason: "empty-selection" | "generation-failed" | "download-blocked";
      message: string;
    };

/**
 * Generates the export and hands it to the browser as a download. A blocked or
 * unsupported download is reported as an explicit failure so callers never
 * announce success for a file the user did not receive.
 */
export function downloadJournalExport(
  selected: readonly TransactionHistoryItem[],
  now: Date = new Date()
): JournalExportDownloadResult {
  const result = generateJournalExport(selected, now);
  if (!result.ok) return result;

  try {
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
      return {
        ok: false,
        reason: "download-blocked",
        message: "Downloads are not supported in this browser. Try a different browser.",
      };
    }
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.rel = "noopener";
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { ok: true, filename: result.filename, count: result.count };
  } catch (error) {
    return {
      ok: false,
      reason: "download-blocked",
      message:
        error instanceof Error
          ? error.message
          : "The download was blocked. Allow downloads for this site and try again.",
    };
  }
}

export function toExportEntry(entry: TransactionHistoryItem): JournalExportEntry {
  const timestamp = Number.isFinite(entry.timestamp) ? new Date(entry.timestamp) : null;
  const out: JournalExportEntry = {
    id: entry.id,
    hash: entry.hash,
    assetPair: entry.assetPair,
    type: entry.type,
    status: entry.status,
    outcome: entry.outcome,
    token: entry.token,
    amount: entry.amount,
    price: entry.price,
    fee: entry.fee,
    timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : "",
    archived: entry.archivedAt !== undefined,
    tags: [...(entry.tags ?? [])],
  };
  if (entry.network) out.network = entry.network;
  const notes = (entry as { notes?: string }).notes;
  if (notes) out.notes = notes;
  if (typeof entry.pnl === "number" && Number.isFinite(entry.pnl)) out.pnl = entry.pnl;
  if (entry.walletAddress) out.walletAddress = entry.walletAddress;
  return out;
}

export function exportFilename(now: Date, count: number): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `journal-export-${count}-entries-${stamp}.json`;
}

/**
 * Builds the JSON export for exactly the given (selected) entries. An empty
 * selection and any generation failure are returned as explicit errors; the
 * function never throws.
 */
export function generateJournalExport(
  selected: readonly TransactionHistoryItem[],
  now: Date = new Date()
): JournalExportResult {
  if (selected.length === 0) {
    return { ok: false, reason: "empty-selection", message: "Select at least one entry to export." };
  }
  try {
    const document: JournalExportDocument = {
      schema: JOURNAL_EXPORT_SCHEMA,
      version: JOURNAL_EXPORT_VERSION,
      exportedAt: now.toISOString(),
      count: selected.length,
      fields: JOURNAL_EXPORT_FIELDS,
      entries: selected.map(toExportEntry),
    };
    const json = JSON.stringify(document, null, 2);
    JSON.parse(json); // validate that what will be downloaded is valid JSON
    return { ok: true, json, filename: exportFilename(now, selected.length), count: selected.length };
  } catch (error) {
    return {
      ok: false,
      reason: "generation-failed",
      message: error instanceof Error ? `Could not generate the export: ${error.message}` : "Could not generate the export.",
    };
  }
}
