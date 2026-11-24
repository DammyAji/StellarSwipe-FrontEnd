export type TransactionStatus =
  | "pending"
  | "submitted"
  | "processing"
  | "success"
  | "confirmed"
  | "failed"
  | "error"
  | "expired"
  | "cancelled";

export type StellarNetwork = "mainnet" | "testnet";

/** A single entry in a transaction's status history. */
export interface TransactionStatusEvent {
  status: TransactionStatus;
  timestamp?: string | null;
}

/** Lifecycle event consumed by the transaction timeline components. */
export interface TransactionLifecycleEvent {
  stage: string;
  status?: TransactionStatus;
  timestamp?: string | null;
  label?: string;
  description?: string;
}

export interface Transaction {
  id: string;
  hash?: string | null;
  asset?: string | null;
  amount?: string | number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: TransactionStatus | null;
  network?: StellarNetwork | null;
  /** Chronological record of status transitions, when tracked. */
  statusHistory?: TransactionStatusEvent[];
}

const STELLAR_EXPLORER_BASE: Record<StellarNetwork, string> = {
  mainnet: "https://stellar.expert/explorer/public",
  testnet: "https://stellar.expert/explorer/testnet",
};

/**
 * Resolve the Stellar network for a transaction, defaulting to mainnet when
 * the network is not explicitly provided.
 */
export function resolveNetwork(
  network?: StellarNetwork | null,
): StellarNetwork {
  return network === "testnet" ? "testnet" : "mainnet";
}

/**
 * Build a network-correct Stellar explorer link for a transaction hash.
 * Returns null when there is no usable hash so callers can omit the link
 * rather than render a misleading URL.
 */
export function getExplorerLink(
  hash?: string | null,
  network?: StellarNetwork | null,
): string | null {
  const trimmed = typeof hash === "string" ? hash.trim() : "";
  if (!trimmed) {
    return null;
  }
  const base = STELLAR_EXPLORER_BASE[resolveNetwork(network)];
  return `${base}/tx/${encodeURIComponent(trimmed)}`;
}

export interface ReceiptField {
  label: string;
  value: string;
  available: boolean;
}

/** Statuses that represent a settled, confirmed transaction. */
const CONFIRMED_STATUSES: ReadonlySet<TransactionStatus> = new Set([
  "success",
  "confirmed",
]);

/**
 * Return the transaction hash only when the transaction has reached a
 * confirmed/success state. Returns null for unconfirmed, failed, or missing
 * hashes so callers never offer an unconfirmed hash as copyable.
 */
export function getConfirmedTransactionHash(
  tx: Transaction | null | undefined,
): string | null {
  if (!tx) {
    return null;
  }
  const status = tx.status ?? null;
  if (!status || !CONFIRMED_STATUSES.has(status)) {
    return null;
  }
  const hash = typeof tx.hash === "string" ? tx.hash.trim() : "";
  return hash ? hash : null;
}

function formatAmount(amount?: string | number | null): string | null {
  if (amount === null || amount === undefined) {
    return null;
  }
  const text = typeof amount === "number" ? String(amount) : amount.trim();
  return text ? text : null;
}

function formatTime(createdAt?: string | null): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

/**
 * Normalize a transaction into receipt fields, marking missing values as
 * unavailable instead of rendering misleading placeholders.
 */
export function buildReceiptFields(tx: Transaction): ReceiptField[] {
  const hash = typeof tx.hash === "string" ? tx.hash.trim() : "";
  const asset = typeof tx.asset === "string" ? tx.asset.trim() : "";
  const amount = formatAmount(tx.amount);
  const time = formatTime(tx.createdAt);
  const status = tx.status ?? null;

  return [
    { label: "Transaction hash", value: hash, available: Boolean(hash) },
    { label: "Asset", value: asset, available: Boolean(asset) },
    { label: "Amount", value: amount ?? "", available: amount !== null },
    { label: "Time", value: time ?? "", available: time !== null },
    { label: "Status", value: status ?? "", available: status !== null },
  ];
}
