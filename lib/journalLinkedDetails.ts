import { getExplorerTxUrl, normalizeNetwork, type StellarNetwork } from "@/lib/stellar/explorer";
import { isOnChainHash } from "@/lib/journalFromTransaction";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

export interface LinkedDetailRow {
  label: string;
  value: string;
  /** False when the value is not known; shown as "Unavailable" rather than guessed. */
  available: boolean;
}

export interface LinkedExecutionDetails {
  /** Whether the entry is linked to an on-chain transaction. */
  linked: boolean;
  rows: LinkedDetailRow[];
  receiptUrl: string | null;
  /** Explains which network the receipt link points to and why. */
  networkNote: string | null;
  statusNote: string | null;
  notes: string | null;
}

const UNAVAILABLE = "Unavailable";

function row(label: string, value: string | null | undefined): LinkedDetailRow {
  const text = (value ?? "").trim();
  return text ? { label, value: text, available: true } : { label, value: UNAVAILABLE, available: false };
}

function entryNetwork(entry: TransactionHistoryItem): StellarNetwork | null {
  if (entry.network === "PUBLIC") return "mainnet";
  if (entry.network === "TESTNET") return "testnet";
  return null;
}

/**
 * Concise execution context for a journal entry. The entry's own record (what the
 * network reported) is kept apart from `notes`, which are the user's words.
 * `fallbackNetwork` is the app-wide network setting, used only when the entry did
 * not record one; the note says so.
 */
export function describeLinkedExecution(
  entry: TransactionHistoryItem,
  fallbackNetwork?: string | null
): LinkedExecutionDetails {
  const notes = (entry.notes ?? "").trim() || null;
  const linked = isOnChainHash(entry.hash);
  if (!linked) {
    return { linked: false, rows: [], receiptUrl: null, networkNote: null, statusNote: null, notes };
  }

  const recorded = entryNetwork(entry);
  const network = recorded ?? normalizeNetwork(fallbackNetwork);
  const networkNote = recorded
    ? null
    : `This entry did not record a network, so the receipt link uses the app's current setting (${network === "testnet" ? "Testnet" : "Mainnet"}).`;

  const time = Number.isFinite(entry.timestamp) ? new Date(entry.timestamp) : null;
  const rows: LinkedDetailRow[] = [
    row("Status", entry.status ? entry.status.charAt(0) + entry.status.slice(1).toLowerCase() : null),
    row("Network", recorded ? (recorded === "mainnet" ? "Mainnet" : "Testnet") : null),
    row("Pair", entry.assetPair),
    row("Amount", entry.amount && entry.token ? `${entry.amount} ${entry.token}` : null),
    row("Price", entry.price),
    row("Fee", entry.fee),
    row("Executed at", time && !Number.isNaN(time.getTime()) ? time.toLocaleString() : null),
  ];

  return {
    linked: true,
    rows,
    receiptUrl: getExplorerTxUrl(entry.hash, network),
    networkNote,
    statusNote: entry.status === "PENDING" ? "Awaiting confirmation: values may still change." : null,
    notes,
  };
}
