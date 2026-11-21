/**
 * Error message mapping for failed Stellar transactions (#290).
 *
 * Maps raw error codes (Stellar `tx_bad_seq`, Horizon result codes, wallet and
 * network failures) to a user-facing title, explanation and troubleshooting
 * suggestions. Unknown codes fall back to a generic, still actionable entry.
 */

export type TransactionErrorCategory =
  | "network"
  | "insufficient_funds"
  | "sequence"
  | "timeout"
  | "rejected"
  | "slippage"
  | "trustline"
  | "account"
  | "fee"
  | "unknown";

export interface TransactionErrorInfo {
  category: TransactionErrorCategory;
  title: string;
  message: string;
  suggestions: string[];
  /** Whether retrying the same operation can plausibly succeed. */
  retryable: boolean;
}

const ERROR_MAP: Record<string, TransactionErrorInfo> = {
  tx_insufficient_balance: {
    category: "insufficient_funds",
    title: "Insufficient balance",
    message: "Your account does not hold enough funds to cover this trade.",
    suggestions: [
      "Reduce the trade amount or add funds to your wallet.",
      "Keep a small XLM reserve for network fees and the base reserve.",
    ],
    retryable: false,
  },
  op_underfunded: {
    category: "insufficient_funds",
    title: "Insufficient balance",
    message: "The source account cannot cover the amount for this operation.",
    suggestions: [
      "Lower the amount and try again.",
      "Check that the funds are not locked in open orders.",
    ],
    retryable: false,
  },
  tx_bad_seq: {
    category: "sequence",
    title: "Outdated transaction",
    message: "The transaction sequence number is out of date.",
    suggestions: [
      "Retry — the sequence number is refreshed automatically.",
      "Close other wallets or tabs submitting transactions for this account.",
    ],
    retryable: true,
  },
  tx_too_late: {
    category: "timeout",
    title: "Transaction expired",
    message: "The transaction expired before it was confirmed.",
    suggestions: [
      "Retry to build a fresh transaction with a new time bound.",
      "Check your network connection before retrying.",
    ],
    retryable: true,
  },
  tx_too_early: {
    category: "timeout",
    title: "Transaction not yet valid",
    message: "The transaction time bounds are in the future.",
    suggestions: ["Retry in a moment.", "Check that your device clock is correct."],
    retryable: true,
  },
  tx_timeout: {
    category: "timeout",
    title: "Network timeout",
    message: "The Stellar network did not respond in time.",
    suggestions: [
      "Retry — the request is retried automatically with backoff.",
      "Check your connection or try again in a few minutes.",
    ],
    retryable: true,
  },
  tx_insufficient_fee: {
    category: "fee",
    title: "Network fee too low",
    message: "The network fee was too low for current congestion.",
    suggestions: [
      "Retry to use the current recommended fee.",
      "Avoid trading during peak network activity.",
    ],
    retryable: true,
  },
  tx_bad_auth: {
    category: "rejected",
    title: "Signature rejected",
    message: "The transaction signature was rejected by the network.",
    suggestions: [
      "Reconnect your wallet and sign again.",
      "Make sure the wallet is on the correct Stellar network.",
    ],
    retryable: true,
  },
  tx_no_source_account: {
    category: "account",
    title: "Account not found",
    message: "The source account does not exist on this network.",
    suggestions: [
      "Fund the account with the minimum XLM reserve.",
      "Confirm your wallet is on the correct network (testnet or mainnet).",
    ],
    retryable: false,
  },
  op_no_trust: {
    category: "trustline",
    title: "Missing trustline",
    message: "Your account has no trustline for this asset.",
    suggestions: [
      "Add a trustline for the asset in your wallet, then retry.",
      "Check that the asset issuer is correct.",
    ],
    retryable: false,
  },
  op_no_destination: {
    category: "account",
    title: "Destination account missing",
    message: "The destination account does not exist.",
    suggestions: [
      "Verify the destination address.",
      "Fund the destination account before sending.",
    ],
    retryable: false,
  },
  op_src_no_trust: {
    category: "trustline",
    title: "Missing trustline",
    message: "The source account has no trustline for this asset.",
    suggestions: ["Add the trustline in your wallet, then retry."],
    retryable: false,
  },
  op_line_full: {
    category: "trustline",
    title: "Trustline limit reached",
    message: "The trustline limit for this asset has been reached.",
    suggestions: [
      "Raise the trustline limit in your wallet.",
      "Reduce the trade amount.",
    ],
    retryable: false,
  },
  op_sell_no_trust: {
    category: "trustline",
    title: "Missing trustline",
    message: "You cannot sell an asset you do not hold a trustline for.",
    suggestions: ["Add the trustline for the asset, then retry."],
    retryable: false,
  },
  op_under_dest_min: {
    category: "slippage",
    title: "Price moved too far",
    message: "The price moved beyond your slippage tolerance.",
    suggestions: [
      "Retry to fetch a fresh quote.",
      "Increase slippage tolerance if you accept the risk.",
    ],
    retryable: true,
  },
  op_over_source_max: {
    category: "slippage",
    title: "Price moved too far",
    message: "The price moved beyond your maximum spend.",
    suggestions: [
      "Retry to fetch a fresh quote.",
      "Adjust the maximum amount you are willing to spend.",
    ],
    retryable: true,
  },
  op_cross_self: {
    category: "rejected",
    title: "Order would cross itself",
    message: "The order would match against your own existing order.",
    suggestions: ["Cancel the conflicting open order, then retry."],
    retryable: false,
  },
  user_rejected: {
    category: "rejected",
    title: "Transaction cancelled",
    message: "The transaction was rejected in your wallet.",
    suggestions: [
      "Approve the request in your wallet to complete the trade.",
      "Retry when you are ready to sign.",
    ],
    retryable: true,
  },
  wallet_not_connected: {
    category: "rejected",
    title: "Wallet not connected",
    message: "No wallet is connected to sign this transaction.",
    suggestions: [
      "Connect your wallet and retry.",
      "Unlock your wallet extension if it is locked.",
    ],
    retryable: true,
  },
  network_error: {
    category: "network",
    title: "Connection problem",
    message: "We could not reach the Stellar network.",
    suggestions: [
      "Check your internet connection.",
      "Retry — the request is retried automatically with backoff.",
    ],
    retryable: true,
  },
  rate_limited: {
    category: "network",
    title: "Too many requests",
    message: "The network is rate limiting requests right now.",
    suggestions: ["Wait a few seconds and retry."],
    retryable: true,
  },
};

const FALLBACK: TransactionErrorInfo = {
  category: "unknown",
  title: "Transaction failed",
  message: "Something went wrong during the trade execution.",
  suggestions: [
    "Retry the transaction.",
    "If the problem persists, check your wallet and network connection.",
  ],
  retryable: true,
};

/** Normalize a raw code so `TX_BAD_SEQ` and `tx_bad_seq` map identically. */
function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Resolve the user-facing error info for a transaction failure.
 * Matches on the explicit code first, then on known codes embedded in the
 * message (Horizon often returns `"Transaction failed: tx_bad_seq"`).
 */
export function getTransactionErrorInfo(
  code?: string | null,
  message?: string | null
): TransactionErrorInfo {
  if (code) {
    const direct = ERROR_MAP[normalizeCode(code)];
    if (direct) return direct;
  }

  if (message) {
    const haystack = normalizeCode(message);
    for (const key of Object.keys(ERROR_MAP)) {
      if (haystack.includes(key)) return ERROR_MAP[key];
    }
  }

  return FALLBACK;
}

/** Exponential backoff delay (ms) for retry attempt `attempt` (1-based). */
export function getRetryDelayMs(
  attempt: number,
  baseMs = 1000,
  maxMs = 16000
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(baseMs * 2 ** (safeAttempt - 1), maxMs);
}

export const MAX_RETRY_ATTEMPTS = 3;
