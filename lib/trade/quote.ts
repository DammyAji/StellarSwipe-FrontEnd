export type QuoteStatus = "valid" | "expired";

export interface TradeQuote {
  id: string;
  amount: string;
  fromAsset: string;
  toAsset: string;
  rate: string;
  expiresAt: number;
  status: QuoteStatus;
  /** Optional quote fee charged in the source asset. */
  fee?: string;
}

/**
 * Rounds a decimal string to the given number of fraction digits using
 * half-up rounding, matching Stellar asset precision rules. Returns the
 * rounded string without trailing zeros beyond the requested precision.
 */
export function roundStellarAmount(value: string, precision: number = 7): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;

  if (!/^\d*(\.\d*)?$/.test(unsigned) || unsigned === "" || unsigned === ".") {
    return trimmed;
  }

  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const digits = Math.max(0, Math.floor(precision));
  const keptFraction = fractionPart.slice(0, digits);
  const nextDigit = fractionPart.charAt(digits);
  const shouldRoundUp = nextDigit !== "" && Number(nextDigit) >= 5;

  let whole = wholePart === "" ? "0" : wholePart;
  let fraction = keptFraction;

  if (shouldRoundUp) {
    const combined = `${whole}${fraction}`.split("");
    let carry = 1;
    for (let i = combined.length - 1; i >= 0 && carry > 0; i -= 1) {
      const digit = Number(combined[i]) + carry;
      combined[i] = String(digit % 10);
      carry = Math.floor(digit / 10);
    }
    if (carry > 0) combined.unshift("1");

    const result = combined.join("");
    const splitAt = result.length - fraction.length;
    whole = result.slice(0, splitAt) || "0";
    fraction = result.slice(splitAt);
  }

  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  const body = normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;

  return negative && body !== "0" ? `-${body}` : body;
}

export interface SubmittedAmountPreview {
  /** Raw amount as entered by the user. */
  input: string;
  /** Exact amount that will be passed to execution. */
  submitted: string;
  /** Whether rounding changed the entered amount. */
  rounded: boolean;
  /** Human-readable explanation of any difference, or null when unchanged. */
  explanation: string | null;
  /** Precision used for rounding. */
  precision: number;
}

export function buildSubmittedAmountPreview(
  input: string,
  precision: number = 7,
): SubmittedAmountPreview {
  const raw = (input ?? "").trim();
  const submitted = roundStellarAmount(raw, precision);
  const rounded = raw !== "" && submitted !== raw;

  return {
    input: raw,
    submitted,
    rounded,
    explanation: rounded
      ? `Entered ${raw} but Stellar precision rounds this to ${submitted}. The trade will submit ${submitted}.`
      : null,
    precision,
  };
}

export type WalletBalances = Record<string, string>;

export interface BalanceImpact {
  asset: string;
  before: string;
  after: string;
  /** Signed change applied to the spendable balance. */
  delta: string;
}

export interface BalancePreview {
  /** Source asset balance impact, or null when unavailable. */
  from: BalanceImpact | null;
  /** Destination asset balance impact, or null when unavailable. */
  to: BalanceImpact | null;
  /** Fee applied to the source asset, or null when no fee was provided. */
  fee: string | null;
  /** Whether the preview reflects the current quote (false when stale). */
  stale: boolean;
  /** Whether all required balances were available to build the preview. */
  available: boolean;
  /** Reason the preview is unavailable or stale, or null when fresh. */
  message: string | null;
}

function parseAmount(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: number, precision: number): string {
  if (!Number.isFinite(value)) return "";
  return roundStellarAmount(value.toFixed(precision), precision);
}

/**
 * Derives before/after spendable balances for a proposed trade using the
 * same wallet balances and quote. Fees are applied to the source asset when
 * provided. The preview is marked stale when the quote is expired or when
 * the quote id does not match the expected quote.
 */
export function buildBalancePreview(
  quote: TradeQuote | null,
  balances: WalletBalances | null,
  options: {
    now?: number;
    precision?: number;
    expectedQuoteId?: string;
  } = {},
): BalancePreview {
  const now = options.now ?? Date.now();
  const precision = options.precision ?? 7;

  if (!quote) {
    return {
      from: null,
      to: null,
      fee: null,
      stale: false,
      available: false,
      message: "Fetch a quote to preview balance changes.",
    };
  }

  const stale =
    isQuoteExpired(quote, now) ||
    (options.expectedQuoteId !== undefined && options.expectedQuoteId !== quote.id);

  const feeValue = parseAmount(quote.fee);
  const fee = feeValue !== null ? formatAmount(feeValue, precision) : null;

  if (!balances) {
    return {
      from: null,
      to: null,
      fee,
      stale,
      available: false,
      message: "Wallet balances are unavailable for this preview.",
    };
  }

  const fromBefore = parseAmount(balances[quote.fromAsset]);
  const toBefore = parseAmount(balances[quote.toAsset]);
  const amount = parseAmount(quote.amount);

  if (fromBefore === null || amount === null) {
    return {
      from: null,
      to: null,
      fee,
      stale,
      available: false,
      message: "Source balance or trade amount is unavailable for this preview.",
    };
  }

  const fromAfter = fromBefore - amount - (feeValue ?? 0);
  const fromImpact: BalanceImpact = {
    asset: quote.fromAsset,
    before: formatAmount(fromBefore, precision),
    after: formatAmount(fromAfter, precision),
    delta: formatAmount(fromAfter - fromBefore, precision),
  };

  let toImpact: BalanceImpact | null = null;
  if (toBefore !== null) {
    const toAfter = toBefore + amount;
    toImpact = {
      asset: quote.toAsset,
      before: formatAmount(toBefore, precision),
      after: formatAmount(toAfter, precision),
      delta: formatAmount(toAfter - toBefore, precision),
    };
  }

  const available = toImpact !== null;
  const message = stale
    ? "This preview is based on a stale quote. Refresh to see current balances."
    : available
      ? null
      : "Destination balance is unavailable for this preview.";

  return {
    from: fromImpact,
    to: toImpact,
    fee,
    stale,
    available,
    message,
  };
}

export interface QuoteReviewState {
  quote: TradeQuote | null;
  expired: boolean;
  canConfirm: boolean;
  message: string;
  refreshing: boolean;
  refreshError: string | null;
}

export type QuoteFetcher = (amount: string) => Promise<TradeQuote>;

export function isQuoteExpired(quote: TradeQuote, now: number = Date.now()): boolean {
  return quote.status === "expired" || quote.expiresAt <= now;
}

export function buildReviewState(
  quote: TradeQuote | null,
  options: { now?: number; refreshing?: boolean; refreshError?: string | null } = {},
): QuoteReviewState {
  const now = options.now ?? Date.now();
  const refreshing = options.refreshing ?? false;
  const refreshError = options.refreshError ?? null;

  if (!quote) {
    return {
      quote: null,
      expired: false,
      canConfirm: false,
      message: "Fetch a quote to review this trade.",
      refreshing,
      refreshError,
    };
  }

  const expired = isQuoteExpired(quote, now);

  if (expired) {
    return {
      quote,
      expired: true,
      canConfirm: false,
      message: "This quote has expired. Refresh to get a new quote before confirming.",
      refreshing,
      refreshError,
    };
  }

  return {
    quote,
    expired: false,
    canConfirm: !refreshing,
    message: "Quote is valid. Review the details and confirm when ready.",
    refreshing,
    refreshError,
  };
}

export interface RefreshQuoteResult {
  state: QuoteReviewState;
  quote: TradeQuote | null;
  error: string | null;
}

/**
 * Refreshes an expired quote while preserving the entered trade amount.
 * On failure the previous amount is retained and retry feedback is exposed.
 */
export async function refreshQuote(
  previous: TradeQuote | null,
  amount: string,
  fetcher: QuoteFetcher,
  now: number = Date.now(),
): Promise<RefreshQuoteResult> {
  const preservedAmount = amount || previous?.amount || "";

  try {
    const fresh = await fetcher(preservedAmount);
    const state = buildReviewState(fresh, { now });
    return { state, quote: fresh, error: null };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Unable to refresh the quote. Please try again.";

    const fallbackQuote: TradeQuote | null = previous
      ? { ...previous, amount: preservedAmount, status: "expired" }
      : null;

    const state = buildReviewState(fallbackQuote, {
      now,
      refreshError: message,
    });

    return { state, quote: fallbackQuote, error: message };
  }
}
