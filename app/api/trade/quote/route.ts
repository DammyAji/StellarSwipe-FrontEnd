/**
 * /api/trade/quote
 *
 * POST  — validates a trade request and returns a server-side preview
 *         (estimates + expiry) before any execution happens.
 * GET   — re-checks a previously issued quote by `quoteId`; returns 410 once
 *         the quote has expired so the client can request a fresh one.
 *
 * Stub: reference prices, fees and the quote store are in-memory placeholders.
 * Replace `REFERENCE_PRICES` with a Horizon/Soroban RPC lookup and the
 * `quotes` map with a shared store (e.g. Redis) before production use.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SUPPORTED_ASSETS = ["XLM", "USDC"] as const;
const SUPPORTED_NETWORKS = ["testnet", "pubnet"] as const;
const QUOTE_TTL_MS = 30_000;
const FEE_RATE = 0.001; // 10 bps
const SLIPPAGE_BPS = 50;

// Precision used for both asset and fiat amounts. Asset units allow up to 7
// decimals (Stellar stroops); fiat is quoted to 2 decimals. Both modes share
// the same minimum so validation is consistent regardless of input focus.
const ASSET_DECIMALS = 7;
const FIAT_DECIMALS = 2;
const MIN_AMOUNT = 0.0000001;

// Reference price of each asset in USDC. Missing entry => market unavailable.
const REFERENCE_PRICES: Partial<Record<(typeof SUPPORTED_ASSETS)[number], number>> = {
  XLM: 0.12,
  USDC: 1,
};

// Stellar public keys: "G" + 55 base32 characters
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

const amountPattern = new RegExp(`^\\d+(\\.\\d{1,${ASSET_DECIMALS}})?$`);

const quoteRequestSchema = z.object({
  asset: z.enum(SUPPORTED_ASSETS),
  direction: z.enum(["BUY", "SELL"]),
  // Which field the user edited. The other amount is derived from the quote.
  inputMode: z.enum(["asset", "fiat"]).default("asset"),
  amount: z
    .string()
    .trim()
    .regex(amountPattern, `Amount must be a positive number with up to ${ASSET_DECIMALS} decimals`)
    .refine((v) => Number(v) >= MIN_AMOUNT, `Amount must be at least ${MIN_AMOUNT}`),
  wallet: z.string().trim().regex(STELLAR_ADDRESS, "Wallet must be a valid Stellar address"),
  network: z.enum(SUPPORTED_NETWORKS),
  // Optional current balances so the review step can preview post-trade
  // balances. Missing entries are surfaced as unavailable estimates.
  balances: z
    .object({
      asset: z.string().trim().regex(amountPattern).optional(),
      fiat: z.string().trim().regex(amountPattern).optional(),
    })
    .optional(),
});

type Quote = z.infer<typeof quoteRequestSchema> & {
  quoteId: string;
  price: number;
  assetAmount: string;
  fiatAmount: string;
  total: number;
  fee: number;
  slippageBps: number;
  quotedAt: number;
  expiresAt: number;
};

const quotes = new Map<string, Quote>();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid trade request",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const request = parsed.data;
  const price = REFERENCE_PRICES[request.asset];

  if (price === undefined) {
    return NextResponse.json(
      { error: `No market available for ${request.asset} right now` },
      { status: 503 }
    );
  }

  const entered = Number(request.amount);
  // Derive the counterpart amount from the current quote so both fields stay
  // synchronized. Fiat is rounded to 2 decimals; asset keeps stroop precision.
  const assetAmount =
    request.inputMode === "asset" ? entered : roundTo(entered / price, ASSET_DECIMALS);
  const fiatAmount =
    request.inputMode === "fiat" ? entered : roundTo(entered * price, FIAT_DECIMALS);

  if (assetAmount < MIN_AMOUNT || fiatAmount < MIN_AMOUNT) {
    return NextResponse.json(
      {
        error: "Invalid trade request",
        issues: [{ path: "amount", message: `Amount must be at least ${MIN_AMOUNT}` }],
      },
      { status: 400 }
    );
  }

  const total = assetAmount * price;
  const now = Date.now();
  const quote: Quote = {
    ...request,
    quoteId: crypto.randomUUID(),
    price,
    assetAmount: formatAmount(assetAmount, ASSET_DECIMALS),
    fiatAmount: formatAmount(fiatAmount, FIAT_DECIMALS),
    total,
    fee: total * FEE_RATE,
    slippageBps: SLIPPAGE_BPS,
    quotedAt: now,
    expiresAt: now + QUOTE_TTL_MS,
  };
  quotes.set(quote.quoteId, quote);

  return NextResponse.json(toResponse(quote), { status: 200 });
}

export async function GET(req: NextRequest) {
  const quoteId = req.nextUrl.searchParams.get("quoteId");
  // The active account the client is currently reviewing with. When supplied,
  // a mismatch against the account the quote was issued for invalidates the
  // review so the client must request a fresh quote before signing.
  const activeWallet = req.nextUrl.searchParams.get("wallet");

  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId parameter" }, { status: 400 });
  }

  const quote = quotes.get(quoteId);

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (activeWallet && activeWallet !== quote.wallet) {
    // The active account changed since this review was created. Drop the
    // stale quote so it cannot be reused and tell the client which account
    // the review now belongs to.
    quotes.delete(quoteId);
    return NextResponse.json(
      {
        error: "Active account changed since this review was created",
        status: "account-changed",
        previousWallet: quote.wallet,
        activeWallet,
        // Preserve the entered amount so the client can re-quote without
        // retyping, but never reuse the old quote's derived figures.
        amount: quote.amount,
        inputMode: quote.inputMode,
        asset: quote.asset,
        direction: quote.direction,
        network: quote.network,
      },
      { status: 409 }
    );
  }

  if (Date.now() >= quote.expiresAt) {
    quotes.delete(quoteId);
    return NextResponse.json(
      { error: "Quote has expired", status: "expired" },
      { status: 410 }
    );
  }

  return NextResponse.json(toResponse(quote), { status: 200 });
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatAmount(value: number, decimals: number): string {
  return roundTo(value, decimals).toFixed(decimals);
}

/**
 * Estimate the balances a user will hold after the proposed trade.
 *
 * BUY  — spend fiat (total + fee), receive the asset.
 * SELL — spend the asset, receive fiat (total - fee).
 *
 * Any missing balance input is reported as `null` with an `unavailable`
 * label so the review step can render it as an estimate rather than a
 * confirmed figure.
 */
function estimateBalances(quote: Quote) {
  const beforeAsset = quote.balances?.asset !== undefined ? Number(quote.balances.asset) : null;
  const beforeFiat = quote.balances?.fiat !== undefined ? Number(quote.balances.fiat) : null;

  const assetDelta = quote.direction === "BUY" ? Number(quote.assetAmount) : -Number(quote.assetAmount);
  const fiatDelta =
    quote.direction === "BUY" ? -(quote.total + quote.fee) : quote.total - quote.fee;

  const afterAsset = beforeAsset === null ? null : roundTo(beforeAsset + assetDelta, ASSET_DECIMALS);
  const afterFiat = beforeFiat === null ? null : roundTo(beforeFiat + fiatDelta, FIAT_DECIMALS);

  return {
    asset: {
      symbol: quote.asset,
      before: beforeAsset === null ? null : formatAmount(beforeAsset, ASSET_DECIMALS),
      after: afterAsset === null ? null : formatAmount(afterAsset, ASSET_DECIMALS),
      delta: formatAmount(assetDelta, ASSET_DECIMALS),
      label: beforeAsset === null ? "unavailable" : "estimate",
    },
    fiat: {
      symbol: "USDC",
      before: beforeFiat === null ? null : formatAmount(beforeFiat, FIAT_DECIMALS),
      after: afterFiat === null ? null : formatAmount(afterFiat, FIAT_DECIMALS),
      delta: formatAmount(fiatDelta, FIAT_DECIMALS),
      label: beforeFiat === null ? "unavailable" : "estimate",
    },
  };
}

function toResponse(quote: Quote) {
  return {
    quoteId: quote.quoteId,
    asset: quote.asset,
    direction: quote.direction,
    inputMode: quote.inputMode,
    amount: quote.amount,
    price: quote.price,
    assetAmount: quote.assetAmount,
    fiatAmount: quote.fiatAmount,
    total: quote.total,
    fee: quote.fee,
    slippageBps: quote.slippageBps,
    quotedAt: quote.quotedAt,
    expiresAt: quote.expiresAt,
    balances: estimateBalances(quote),
  };
}
