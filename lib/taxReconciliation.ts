import Papa from "papaparse";
import type { TaxableTransaction } from "@/lib/taxUtils";

export interface ImportedTaxRow {
  /** 1-based row number in the imported file (excluding the header). */
  rowId: string;
  /** Calendar date as written in the file, normalized to YYYY-MM-DD. */
  date: string;
  assetPair: string;
  amount: number;
  hash?: string;
}

export type MatchStatus = "matched" | "unmatched" | "ambiguous";
export type MatchBasis = "hash" | "details" | "confirmed";

export interface Candidate {
  transactionId: string;
  basis: "hash" | "details";
  label: string;
}

export interface ReconciledRow {
  row: ImportedTaxRow;
  status: MatchStatus;
  basis: MatchBasis | null;
  /** The transaction the row is matched to, when matched. */
  matchedTransactionId: string | null;
  candidates: Candidate[];
  reason: string;
}

export interface RowDecision {
  confirmed?: string;
  dismissed?: string[];
}

export type Decisions = Record<string, RowDecision>;

export interface ParseResult {
  rows: ImportedTaxRow[];
  errors: string[];
}

/** Relative amount difference still treated as the same amount. */
export const AMOUNT_TOLERANCE = 1e-6;

const HEADER_ALIASES: Record<"date" | "assetPair" | "amount" | "hash", string[]> = {
  date: ["date", "time", "timestamp"],
  assetPair: ["asset pair", "assetpair", "pair", "asset"],
  amount: ["amount", "quantity"],
  hash: ["hash", "tx hash", "txhash", "transaction hash", "transaction"],
};

function findColumn(fields: string[], aliases: string[]): string | undefined {
  return fields.find((f) => aliases.includes(f.trim().toLowerCase()));
}

function toDay(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return d.getUTCFullYear() === Number(iso[1]) && d.getUTCMonth() === Number(iso[2]) - 1 && d.getUTCDate() === Number(iso[3])
      ? `${iso[1]}-${iso[2]}-${iso[3]}`
      : null;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().split("T")[0];
}

/**
 * Reads imported tax rows from CSV text. Rows that cannot be read are reported in
 * `errors` (with their row number) instead of being dropped silently.
 */
export function parseImportedRows(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  const fields = parsed.meta.fields ?? [];
  const dateCol = findColumn(fields, HEADER_ALIASES.date);
  const pairCol = findColumn(fields, HEADER_ALIASES.assetPair);
  const amountCol = findColumn(fields, HEADER_ALIASES.amount);
  const hashCol = findColumn(fields, HEADER_ALIASES.hash);
  const errors: string[] = [];
  if (!dateCol || !pairCol || !amountCol) {
    const missing = [!dateCol && "Date", !pairCol && "Asset Pair", !amountCol && "Amount"].filter(Boolean).join(", ");
    return { rows: [], errors: [`The file is missing required column(s): ${missing}.`] };
  }
  const rows: ImportedTaxRow[] = [];
  parsed.data.forEach((record, index) => {
    const rowId = String(index + 1);
    const date = toDay(record[dateCol] ?? "");
    const assetPair = (record[pairCol] ?? "").trim();
    const amount = Number((record[amountCol] ?? "").replace(/,/g, "").trim());
    if (!date) return void errors.push(`Row ${rowId}: the date "${record[dateCol] ?? ""}" is not valid.`);
    if (!assetPair) return void errors.push(`Row ${rowId}: the asset pair is empty.`);
    if (!Number.isFinite(amount) || amount <= 0) return void errors.push(`Row ${rowId}: the amount "${record[amountCol] ?? ""}" is not a positive number.`);
    const hash = hashCol ? (record[hashCol] ?? "").trim() : "";
    rows.push({ rowId, date, assetPair, amount, hash: hash || undefined });
  });
  return { rows, errors };
}

function describe(tx: TaxableTransaction): string {
  return `${tx.assetPair} ${tx.amount} on ${new Date(tx.timestamp).toISOString().split("T")[0]}`;
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE * Math.max(Math.abs(a), Math.abs(b), 1);
}

/**
 * Finds candidate transactions for each imported row: by transaction hash when the
 * row has one, otherwise by asset pair, calendar day (UTC) and amount. A row with
 * exactly one candidate is matched, none is unmatched, and several (or a candidate
 * claimed by more than one row) is ambiguous and is never matched automatically.
 */
export function reconcileRows(rows: readonly ImportedTaxRow[], transactions: readonly TaxableTransaction[]): ReconciledRow[] {
  const byHash = new Map<string, TaxableTransaction[]>();
  for (const tx of transactions) {
    const hash = tx.source?.hash;
    if (hash) byHash.set(hash, [...(byHash.get(hash) ?? []), tx]);
  }

  const initial = rows.map((row) => {
    let candidates: Candidate[] = [];
    if (row.hash && byHash.has(row.hash)) {
      candidates = byHash.get(row.hash)!.map((tx) => ({ transactionId: tx.id, basis: "hash" as const, label: describe(tx) }));
    } else {
      candidates = transactions
        .filter(
          (tx) =>
            tx.assetPair.toLowerCase() === row.assetPair.toLowerCase() &&
            new Date(tx.timestamp).toISOString().split("T")[0] === row.date &&
            sameAmount(tx.amount, row.amount)
        )
        .map((tx) => ({ transactionId: tx.id, basis: "details" as const, label: describe(tx) }));
    }
    return { row, candidates };
  });

  // A transaction that is the only candidate of several rows cannot be assigned to just one of them.
  const claims = new Map<string, number>();
  for (const { candidates } of initial) {
    if (candidates.length === 1) claims.set(candidates[0].transactionId, (claims.get(candidates[0].transactionId) ?? 0) + 1);
  }

  return initial.map(({ row, candidates }): ReconciledRow => {
    if (candidates.length === 0) {
      return { row, status: "unmatched", basis: null, matchedTransactionId: null, candidates, reason: "No recognized transaction has the same hash or the same pair, day and amount." };
    }
    if (candidates.length > 1) {
      return { row, status: "ambiguous", basis: null, matchedTransactionId: null, candidates, reason: `${candidates.length} recognized transactions fit this row. Confirm the right one.` };
    }
    const only = candidates[0];
    if ((claims.get(only.transactionId) ?? 0) > 1) {
      return { row, status: "ambiguous", basis: null, matchedTransactionId: null, candidates, reason: "Several imported rows fit the same transaction. Confirm which row it belongs to." };
    }
    return { row, status: "matched", basis: only.basis, matchedTransactionId: only.transactionId, candidates, reason: only.basis === "hash" ? "Same transaction hash." : "Same pair, day and amount." };
  });
}

/**
 * Applies the user's confirm/dismiss decisions. A confirmed candidate becomes the
 * match. Dismissing removes a candidate; a row that started ambiguous stays
 * ambiguous until one candidate is explicitly confirmed, and a row left with no
 * candidates is unmatched.
 */
export function applyDecisions(reconciled: readonly ReconciledRow[], decisions: Decisions): ReconciledRow[] {
  return reconciled.map((item) => {
    const decision = decisions[item.row.rowId];
    if (!decision) return item;
    const dismissed = new Set(decision.dismissed ?? []);
    const remaining = item.candidates.filter((c) => !dismissed.has(c.transactionId));
    if (decision.confirmed && remaining.some((c) => c.transactionId === decision.confirmed)) {
      return { ...item, status: "matched", basis: "confirmed", matchedTransactionId: decision.confirmed, candidates: remaining, reason: "Confirmed by you." };
    }
    if (remaining.length === 0) {
      return { ...item, status: "unmatched", basis: null, matchedTransactionId: null, candidates: [], reason: "All candidates were dismissed." };
    }
    if (item.status === "matched" && remaining.length === item.candidates.length) return item;
    return {
      ...item,
      status: "ambiguous",
      basis: null,
      matchedTransactionId: null,
      candidates: remaining,
      reason: remaining.length === 1 ? "One candidate is left. Confirm it to match this row." : `${remaining.length} recognized transactions fit this row. Confirm the right one.`,
    };
  });
}

export function countByStatus(items: readonly ReconciledRow[]): Record<MatchStatus, number> {
  return {
    matched: items.filter((i) => i.status === "matched").length,
    unmatched: items.filter((i) => i.status === "unmatched").length,
    ambiguous: items.filter((i) => i.status === "ambiguous").length,
  };
}
