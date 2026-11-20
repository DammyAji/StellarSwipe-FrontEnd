import { create } from "zustand";

export type TransactionStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type TransactionOutcome = "WIN" | "LOSS" | "PENDING";
export type TransactionType = "COPY_TRADE" | "SWAP" | "MANUAL";
/** Matches NEXT_PUBLIC_STELLAR_NETWORK values (see .env.example). */
export type StellarNetwork = "TESTNET" | "PUBLIC";

/** Terminal statuses never transition again; retries must not overwrite them. */
const TERMINAL_STATUSES: TransactionStatus[] = ["SUCCEEDED", "FAILED"];

export interface TransactionDetails {
  hash: string;
  amount: string;
  price: string;
  fee: string;
  token: string;
  timestamp: number;
  /** Stellar network the transaction was submitted to, when known. */
  network?: StellarNetwork;
}

export interface TransactionHistoryItem extends TransactionDetails {
  id: string;
  assetPair: string;
  type: TransactionType;
  status: TransactionStatus;
  outcome: TransactionOutcome;
  /** Stellar network the transaction was submitted to, when known. */
  network?: StellarNetwork;
  /** Set when the entry is archived; cleared when it is restored. */
  archivedAt?: number;
  /** Server revision the entry was last saved at; used to detect conflicting edits. */
  revision?: number;
  /** Normalized strategy/setup labels, e.g. "breakout", "dca". */
  tags?: string[];
  /** The user's own notes about the trade (never filled from the network). */
  notes?: string;
  /** Realized profit/loss in quote currency, when known. */
  pnl?: number;
  /** Stellar account the entry was made from, when known. */
  walletAddress?: string;
}

export interface TransactionError {
  message: string;
  code?: string;
  reason?: string;
}

interface TransactionState {
  success: TransactionDetails | null;
  showSuccess: boolean;
  error: TransactionError | null;
  showError: boolean;
  preservedInput: Record<string, unknown> | null;
  history: TransactionHistoryItem[];
  /** IDs of entries that are currently being synced with the server. */
  pendingIds: string[];
  /** IDs of entries that failed to sync (optimistic update needs rollback). */
  failedIds: string[];

  setSuccess: (details: TransactionDetails) => void;
  clearSuccess: () => void;
  setError: (error: TransactionError) => void;
  clearError: () => void;
  setPreservedInput: (input: Record<string, unknown> | null) => void;
  addTransaction: (transaction: TransactionHistoryItem) => void;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, patch: Partial<TransactionHistoryItem>) => TransactionHistoryItem | null;
  bulkAddTransactions: (transactions: TransactionHistoryItem[]) => void;
  updateTransactionStatus: (
    id: string,
    status: TransactionStatus,
    outcome?: TransactionOutcome
  ) => void;
  /** Mark an entry as pending sync. */
  markPending: (id: string) => void;
  /** Clear pending flag after successful sync. */
  clearPending: (id: string) => void;
  /** Mark an entry as failed and schedule it for retry. */
  markFailed: (id: string) => void;
  /** Remove failed marker. */
  clearFailed: (id: string) => void;
  reset: () => void;
}

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  success: null,
  showSuccess: false,
  error: null,
  showError: false,
  preservedInput: null,
  pendingIds: [],
  failedIds: [],
  history: [
    {
      id: "tx-1",
      hash: "b3f9c18e6b7a4cd81d2f3a9ed7f8c6b9f2d7a1b3c4e5f6a7b8c9d0e1f2a3b4",
      assetPair: "XLM/USDC",
      amount: "120",
      price: "0.4821",
      fee: "0.0004",
      token: "XLM",
      timestamp: Date.now() - 120000,
      type: "COPY_TRADE",
      status: "PENDING",
      outcome: "PENDING",
    },
    {
      id: "tx-2",
      hash: "c9d1b2a4e3f5d6c7b8a9e0f1d2c3b4a5e6f7d8c9b1a2e3f4c5d6b7a8e9f0d1",
      assetPair: "AQUA/XLM",
      amount: "42",
      price: "0.1450",
      fee: "0.0003",
      token: "AQUA",
      timestamp: Date.now() - 3600000,
      type: "SWAP",
      status: "SUCCEEDED",
      outcome: "WIN",
    },
    {
      id: "tx-3",
      hash: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1",
      assetPair: "USDC/XLM",
      amount: "65",
      price: "0.5290",
      fee: "0.0002",
      token: "USDC",
      timestamp: Date.now() - 7200000,
      type: "MANUAL",
      status: "FAILED",
      outcome: "LOSS",
    },
  ],

  setSuccess: (details) =>
    set({ success: details, showSuccess: true, error: null, showError: false }),

  clearSuccess: () => set({ success: null, showSuccess: false }),

  setError: (error) =>
    set({ error, showError: true, success: null, showSuccess: false }),

  clearError: () => set({ error: null, showError: false }),

  setPreservedInput: (input) => set({ preservedInput: input }),

  // Idempotent: a retried submission with the same id or hash is ignored.
  addTransaction: (transaction) =>
    set((state) => {
      const exists = state.history.some(
        (item) =>
          item.id === transaction.id ||
          (!!transaction.hash && item.hash === transaction.hash)
      );
      return exists ? state : { history: [transaction, ...state.history] };
    }),

  removeTransaction: (id) =>
    set((state) => ({
      history: state.history.filter((item) => item.id !== id),
    })),

  updateTransaction: (id, patch) => {
    set((state) => ({
      history: state.history.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
    // Look up the updated item after the state has been updated
    const updated = get().history.find((item) => item.id === id) ?? null;
    return updated;
  },

  bulkAddTransactions: (transactions) =>
    set((state) => ({ history: [...transactions, ...state.history] })),

  // Idempotent: repeated updates are no-ops once an entry is terminal.
  updateTransactionStatus: (id, status, outcome) =>
    set((state) => ({
      history: state.history.map((item) =>
        item.id !== id || TERMINAL_STATUSES.includes(item.status)
          ? item
          : {
              ...item,
              status,
              outcome:
                outcome ??
                (status === "SUCCEEDED"
                  ? "WIN"
                  : status === "FAILED"
                  ? "LOSS"
                  : item.outcome),
            }
      ),
    })),

  markPending: (id) =>
    set((state) => ({
      pendingIds: state.pendingIds.includes(id)
        ? state.pendingIds
        : [...state.pendingIds, id],
      failedIds: state.failedIds.filter((fid) => fid !== id),
    })),

  clearPending: (id) =>
    set((state) => ({
      pendingIds: state.pendingIds.filter((pid) => pid !== id),
    })),

  markFailed: (id) =>
    set((state) => ({
      failedIds: state.failedIds.includes(id)
        ? state.failedIds
        : [...state.failedIds, id],
      pendingIds: state.pendingIds.filter((pid) => pid !== id),
    })),

  clearFailed: (id) =>
    set((state) => ({
      failedIds: state.failedIds.filter((fid) => fid !== id),
    })),

  reset: () =>
    set({
      success: null,
      showSuccess: false,
      error: null,
      showError: false,
      preservedInput: null,
      history: [],
      pendingIds: [],
      failedIds: [],
    }),
}));
