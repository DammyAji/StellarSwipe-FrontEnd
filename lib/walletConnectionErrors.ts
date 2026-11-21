export type WalletConnectionReason =
  | "user_rejected"
  | "timeout"
  | "wallet_not_found"
  | "wallet_locked"
  | "network_unavailable"
  | "unknown";

export interface WalletConnectionErrorInfo {
  reason: WalletConnectionReason;
  retryable: boolean;
  showModal: boolean;
  i18nKey: string;
}

const REJECTION_PATTERN =
  /user (?:rejected|cancell?ed|denied)|(?:rejected|cancell?ed|denied) by (?:the )?user|action_rejected|request rejected/i;
const TIMEOUT_PATTERN = /timed? ?out|timeout/i;
const LOCKED_PATTERN = /locked|unlock|passcode/i;
const NOT_FOUND_PATTERN =
  /no wallet|wallet (?:not )?found|wallet.*not installed|no provider|no extension|extension.*(?:not installed|missing)|not installed/i;
const NETWORK_PATTERN = /network|offline|disconnected|fetch failed|failed to fetch/i;

const EIP1193_REJECTED_CODE = 4001;
const EIP1193_TIMEOUT_CODE = -1001;

function codeOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : null;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

export function isUserRejection(error: unknown): boolean {
  return codeOf(error) === EIP1193_REJECTED_CODE || REJECTION_PATTERN.test(messageOf(error));
}

export function isTimeoutError(error: unknown): boolean {
  return codeOf(error) === EIP1193_TIMEOUT_CODE || TIMEOUT_PATTERN.test(messageOf(error));
}

function classify(error: unknown): WalletConnectionReason {
  if (isUserRejection(error)) return "user_rejected";
  if (isTimeoutError(error)) return "timeout";
  if (LOCKED_PATTERN.test(messageOf(error))) return "wallet_locked";
  if (NOT_FOUND_PATTERN.test(messageOf(error))) return "wallet_not_found";
  if (NETWORK_PATTERN.test(messageOf(error))) return "network_unavailable";
  return "unknown";
}

export function shouldRetryConnection(reason: WalletConnectionReason): boolean {
  return (
    reason === "user_rejected" ||
    reason === "timeout" ||
    reason === "network_unavailable" ||
    reason === "unknown"
  );
}

export function classifyWalletConnectionError(
  error: unknown,
): WalletConnectionErrorInfo {
  const reason = classify(error);
  return {
    reason,
    retryable: shouldRetryConnection(reason),
    showModal: reason !== "user_rejected",
    i18nKey: `wallet.connect_error.${reason}`,
  };
}

/**
 * Maps a classified reason onto the recovery modal's reason union.
 * `user_rejected` is surfaced as a toast only, so it maps to `null`.
 */
export function toConnectErrorReason(
  reason: WalletConnectionReason,
): "not_found" | "timeout" | "error" | null {
  switch (reason) {
    case "wallet_not_found":
      return "not_found";
    case "timeout":
      return "timeout";
    case "user_rejected":
      return null;
    default:
      return "error";
  }
}
