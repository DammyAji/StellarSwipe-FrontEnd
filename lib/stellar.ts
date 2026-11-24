import { Horizon } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Minimum XLM a signal provider must stake to remain listed on the protocol */
export const PROTOCOL_MIN_STAKE_XLM = 1000;
/**
 * Fraction above the minimum at which a low-stake warning badge is shown.
 * E.g. 0.2 means warn when providerStake <= 1200 XLM (20% above the 1000 XLM floor).
 */
export const LOW_STAKE_WARNING_MARGIN = 0.2;

export const server = new Horizon.Server(HORIZON_URL);

export async function getAccountBalances(publicKey: string) {
  const account = await server.loadAccount(publicKey);
  return account.balances;
}

/**
 * Default precision (decimal places) used for Stellar assets when the asset
 * does not advertise its own precision. Stellar's native XLM uses 7 decimals.
 */
export const DEFAULT_ASSET_PRECISION = 7;

export interface RoundedAmount {
  /** The amount rounded to the asset's precision. This is the value that must be submitted to execution. */
  rounded: number;
  /** The raw input amount as provided by the user. */
  raw: number;
  /** rounded - raw. Positive when rounding up, negative when rounding down. */
  delta: number;
  /** Number of decimal places the amount was rounded to. */
  precision: number;
  /** True when rounding changed the value (delta !== 0). */
  wasRounded: boolean;
  /** Human-readable explanation of the difference, or null when no rounding occurred. */
  explanation: string | null;
}

/**
 * Rounds a numeric amount to the given asset precision and reports the delta
 * from the raw input. The returned `rounded` value is the exact amount that
 * should be displayed to the user and passed to execution so the two always match.
 */
export function roundToAssetPrecision(
  amount: number,
  precision: number = DEFAULT_ASSET_PRECISION,
): RoundedAmount {
  const safePrecision =
    Number.isFinite(precision) && precision >= 0
      ? Math.floor(precision)
      : DEFAULT_ASSET_PRECISION;

  if (!Number.isFinite(amount)) {
    return {
      rounded: NaN,
      raw: amount,
      delta: NaN,
      precision: safePrecision,
      wasRounded: false,
      explanation: null,
    };
  }

  const factor = Math.pow(10, safePrecision);
  const rounded = Math.round(amount * factor) / factor;
  const delta = rounded - amount;
  // Guard against floating point noise producing a tiny non-zero delta.
  const epsilon = factor > 0 ? 1 / (factor * 1e6) : 0;
  const wasRounded = Math.abs(delta) > epsilon;

  let explanation: string | null = null;
  if (wasRounded) {
    const direction = delta > 0 ? "up" : "down";
    const absDelta = Math.abs(delta);
    explanation =
      `Amount rounded ${direction} by ${absDelta} to ${safePrecision} decimal place` +
      `${safePrecision === 1 ? "" : "s"} (asset precision).`;
  }

  return {
    rounded,
    raw: amount,
    delta,
    precision: safePrecision,
    wasRounded,
    explanation,
  };
}

/**
 * Formats the submitted amount for display, including the rounded value and,
 * when rounding occurred, an explanation of the difference from the raw input.
 */
export function formatSubmittedAmount(
  amount: number,
  precision: number = DEFAULT_ASSET_PRECISION,
): { display: string; rounded: number; explanation: string | null } {
  const result = roundToAssetPrecision(amount, precision);
  const display = Number.isFinite(result.rounded)
    ? result.rounded.toFixed(result.precision)
    : "—";
  return {
    display,
    rounded: result.rounded,
    explanation: result.explanation,
  };
}

export interface QuoteFees {
  /** Fee amount denominated in the source asset. */
  amount: number;
  /** Optional asset code the fee is denominated in. */
  asset?: string;
}

export interface TradeQuote {
  /** Amount of the source asset the user is spending (before fees). */
  sellAmount: number;
  /** Amount of the destination asset the user receives. */
  buyAmount: number;
  /** Source asset code, e.g. "XLM" or "USDC". */
  sellAsset: string;
  /** Destination asset code. */
  buyAsset: string;
  /** Optional fee(s) charged in the source asset. */
  fees?: QuoteFees[] | number | null;
}

export interface BalancePreview {
  asset: string;
  /** Spendable balance before the trade. */
  before: number;
  /** Spendable balance after the trade, including fees when provided. */
  after: number;
  /** Total amount deducted from the source asset (sell amount + fees). */
  totalDebit: number;
  /** Total fees applied, in the source asset. */
  totalFees: number;
  /** True when the resulting balance would be negative (insufficient funds). */
  insufficient: boolean;
}

export interface SpendablePreview {
  /** Preview for the source (sold) asset. */
  sell: BalancePreview;
  /** Preview for the destination (bought) asset. */
  buy: BalancePreview;
}

function sumFees(fees: TradeQuote["fees"]): number {
  if (fees == null) return 0;
  if (typeof fees === "number") return Number.isFinite(fees) ? fees : 0;
  return fees.reduce(
    (total, fee) => total + (Number.isFinite(fee?.amount) ? fee.amount : 0),
    0,
  );
}

/**
 * Computes before/after spendable balances for a proposed trade using the
 * wallet's current balances and the quote (including fees when present).
 *
 * @param balances Map of asset code -> current spendable balance.
 * @param quote The proposed trade quote.
 * @param precision Optional per-asset precision overrides.
 */
export function computeSpendablePreview(
  balances: Record<string, number>,
  quote: TradeQuote,
  precision?: Record<string, number>,
): SpendablePreview {
  const sellPrecision =
    precision?.[quote.sellAsset] ?? DEFAULT_ASSET_PRECISION;
  const buyPrecision = precision?.[quote.buyAsset] ?? DEFAULT_ASSET_PRECISION;

  const sellBefore = Number.isFinite(balances[quote.sellAsset])
    ? balances[quote.sellAsset]
    : 0;
  const buyBefore = Number.isFinite(balances[quote.buyAsset])
    ? balances[quote.buyAsset]
    : 0;

  const totalFees = sumFees(quote.fees);
  const sellRounded = roundToAssetPrecision(quote.sellAmount, sellPrecision);
  const buyRounded = roundToAssetPrecision(quote.buyAmount, buyPrecision);

  const totalDebit = sellRounded.rounded + totalFees;
  const sellAfter = roundToAssetPrecision(
    sellBefore - totalDebit,
    sellPrecision,
  ).rounded;
  const buyAfter = roundToAssetPrecision(
    buyBefore + buyRounded.rounded,
    buyPrecision,
  ).rounded;

  return {
    sell: {
      asset: quote.sellAsset,
      before: sellBefore,
      after: sellAfter,
      totalDebit,
      totalFees,
      insufficient: sellAfter < 0,
    },
    buy: {
      asset: quote.buyAsset,
      before: buyBefore,
      after: buyAfter,
      totalDebit: buyRounded.rounded,
      totalFees: 0,
      insufficient: buyAfter < 0,
    },
  };
}