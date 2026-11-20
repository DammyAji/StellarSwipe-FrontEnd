import type { JournalEntry } from "@/lib/journalSchema";
import type {
  StellarNetwork,
  TransactionDetails,
  TransactionHistoryItem,
} from "@/store/useTransactionStore";

/** Hash prefixes the journal uses for entries that are not on-chain transactions. */
const OFF_CHAIN_HASH_PREFIXES = ["manual-", "csv-"] as const;

/** True when the hash looks like a real on-chain transaction hash. */
export function isOnChainHash(hash: string | null | undefined): boolean {
  const value = (hash ?? "").trim();
  if (value.length < 16) return false;
  return !OFF_CHAIN_HASH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export interface JournalDraftFromTransaction {
  /** Stable key used to avoid queueing the same transaction twice. */
  key: string;
  /** Values to place in the editor; only fields the transaction actually provided. */
  draft: Partial<JournalEntry>;
  /** On-chain hash to keep on the created entry, when the transaction has one. */
  linkedHash: string | null;
  linkedNetwork: StellarNetwork | null;
  /** Human-readable names of fields the transaction did not provide. */
  missing: string[];
  /** Known context shown next to the editor so the user can see where values came from. */
  context: Array<{ label: string; value: string }>;
}

type TransactionLike = TransactionDetails &
  Partial<Pick<TransactionHistoryItem, "assetPair" | "type" | "status" | "outcome">>;

function positiveNumberString(value: string | undefined): string | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? text : undefined;
}

function nonNegativeNumberString(value: string | undefined): string | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? text : undefined;
}

function toDateInputValue(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split("T")[0];
}

/** Stable identity of a transaction for duplicate detection. */
export function transactionKey(tx: Pick<TransactionDetails, "hash" | "timestamp" | "amount" | "token">): string {
  const hash = (tx.hash ?? "").trim();
  return hash ? `hash:${hash}` : `sig:${tx.timestamp}|${tx.amount}|${tx.token}`;
}

/**
 * Builds an editable journal draft from an executed transaction. Only values the
 * transaction provides are carried over; anything else is reported in `missing`
 * instead of being guessed.
 */
export function buildJournalDraftFromTransaction(tx: TransactionLike): JournalDraftFromTransaction {
  const hash = (tx.hash ?? "").trim();
  const linkedHash = isOnChainHash(hash) ? hash : null;
  const draft: Partial<JournalEntry> = {};
  const missing: string[] = [];

  const date = toDateInputValue(tx.timestamp);
  if (date) draft.date = date;
  else missing.push("date");

  const assetPair = (tx.assetPair ?? "").trim();
  if (assetPair) draft.assetPair = assetPair;
  else missing.push("asset pair");

  const amount = positiveNumberString(tx.amount);
  if (amount) draft.amount = amount;
  else missing.push("amount");

  const price = positiveNumberString(tx.price);
  if (price) draft.price = price;
  else missing.push("price");

  const fee = nonNegativeNumberString(tx.fee);
  if (fee !== undefined) draft.fee = fee;
  else missing.push("fee");

  const token = (tx.token ?? "").trim();
  if (token) draft.token = token;
  else missing.push("token");

  if (tx.type) draft.type = tx.type;
  else missing.push("trade type");

  // A transaction reported as executed has succeeded; its profit/loss is not known yet.
  draft.status = tx.status ?? "SUCCEEDED";
  if (tx.outcome) draft.outcome = tx.outcome;

  const context: Array<{ label: string; value: string }> = [];
  if (linkedHash) context.push({ label: "Transaction", value: `${linkedHash.slice(0, 8)}…${linkedHash.slice(-6)}` });
  if (tx.network) context.push({ label: "Network", value: tx.network === "PUBLIC" ? "Mainnet" : "Testnet" });

  return {
    key: transactionKey(tx),
    draft,
    linkedHash,
    linkedNetwork: tx.network ?? null,
    missing,
    context,
  };
}

/** The existing journal entry that already records this on-chain hash, if any. */
export function findJournalEntryByHash(
  history: readonly TransactionHistoryItem[],
  hash: string | null | undefined
): TransactionHistoryItem | null {
  const wanted = (hash ?? "").trim();
  if (!wanted) return null;
  return history.find((item) => item.hash === wanted) ?? null;
}

export type JournalDraftPlan =
  | { status: "exists"; entryId: string }
  | { status: "already-queued" }
  | { status: "new"; draft: JournalDraftFromTransaction };

/**
 * Decides what a click on "Add to journal" should do so repeated clicks never
 * create duplicates: an existing entry is reused, an already-open draft is left
 * alone, and only otherwise is a new draft started.
 */
export function planJournalDraft(
  tx: TransactionLike,
  history: readonly TransactionHistoryItem[],
  queuedKey: string | null
): JournalDraftPlan {
  const draft = buildJournalDraftFromTransaction(tx);
  const existing = findJournalEntryByHash(history, draft.linkedHash);
  if (existing) return { status: "exists", entryId: existing.id };
  if (queuedKey !== null && queuedKey === draft.key) return { status: "already-queued" };
  return { status: "new", draft };
}
