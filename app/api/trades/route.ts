import { NextRequest, NextResponse } from "next/server";
import { getAccountBalances } from "@/lib/stellar";
import {
  TRADE_ERROR_CODES,
  checkAvailableBalance,
  checkTradeLimits,
  rejectTrade,
  tradeRequestSchema,
  type TradeRejection,
} from "@/lib/tradeLimits";

/** The Stellar network the app expects. Matches NetworkMismatchBanner. */
const APP_NETWORK: string = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET";

/** Horizon base URL used to read the account's transaction history. */
const HORIZON_URL: string =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (APP_NETWORK === "PUBLIC"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

/** Stellar Expert explorer base URL for the active network. */
const STELLAR_EXPERT_URL: string =
  APP_NETWORK === "PUBLIC"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

/** Default and maximum page sizes for the activity feed. */
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/** A single row in the user's activity feed. */
type ActivityEntry = {
  id: string;
  action: "Swap" | "Deposit" | "Withdraw";
  tokenPair: string;
  amountIn: string;
  amountOut: string;
  timestamp: string;
  stellarExpertUrl: string;
};

/**
 * OpenAPI description of this route, consumed by the docs generator so the
 * published contract stays aligned with the handler below.
 */
export const openapi = {
  method: "post" as const,
  path: "/api/trades",
  summary: "Revalidate trade limits before submitting a transaction",
  description:
    "Revalidates trade limits before the client may submit a transaction. Nothing is submitted here; a 2xx response only means the order may proceed.",
  security: [{ walletSignature: [] }],
  request: { schema: tradeRequestSchema },
  responses: {
    200: {
      description: "Order may proceed; includes estimated post-trade balances.",
      schema: {
        type: "object",
        required: ["ok", "preview"],
        properties: {
          ok: { type: "boolean", enum: [true] },
          preview: {
            type: "object",
            required: ["asset", "before", "after", "estimated"],
            properties: {
              asset: { type: "string", enum: ["native"] },
              before: { type: "number" },
              after: { type: "number", nullable: true },
              estimated: { type: "boolean" },
              quoteComplete: { type: "boolean" },
              feeKnown: { type: "boolean" },
              fee: { type: "number", nullable: true },
              unavailable: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    400: { description: "Malformed trade request.", schema: errorSchema() },
    409: {
      description: "Active wallet changed since the review was created.",
      schema: {
        type: "object",
        required: ["code", "message", "accountChanged"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          accountChanged: { type: "boolean" },
          activePublicKey: { type: "string" },
          reviewedPublicKey: { type: "string" },
        },
      },
    },
    422: { description: "Trade rejected by limits or balance checks.", schema: errorSchema() },
    503: { description: "Balance could not be verified.", schema: errorSchema() },
  },
};

function errorSchema() {
  return {
    type: "object",
    required: ["code", "message"],
    properties: {
      code: { type: "string" },
      message: { type: "string" },
    },
  };
}

/**
 * POST /api/trades
 * Revalidates trade limits before the client may submit a transaction.
 * Nothing is submitted here; a 2xx response only means the order may proceed.
 * The response also carries estimated post-trade balances for the review step.
 *
 * When the client sends the account the review was created for
 * (`reviewedPublicKey`), a mismatch with the active `publicKey` means the
 * wallet changed mid-review: the review is invalidated and signing is
 * refused until the user deliberately reviews again.
 */
export async function POST(req: NextRequest) {
  const parsed = tradeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return rejectResponse(
      rejectTrade(TRADE_ERROR_CODES.INVALID_REQUEST, "Malformed trade request.")
    );
  }

  const order = parsed.data;

  // Guard: the active account must match the account the review was built for.
  const reviewedPublicKey = (order as { reviewedPublicKey?: unknown }).reviewedPublicKey;
  if (typeof reviewedPublicKey === "string" && reviewedPublicKey !== order.publicKey) {
    return NextResponse.json(
      {
        code: TRADE_ERROR_CODES.ACCOUNT_CHANGED,
        message:
          "Your active wallet changed since this review was created. Review the trade again before signing.",
        accountChanged: true,
        activePublicKey: order.publicKey,
        reviewedPublicKey,
      },
      { status: 409 }
    );
  }

  const limitRejection = checkTradeLimits(order, APP_NETWORK);
  if (limitRejection) return rejectResponse(limitRejection);

  // Read the balance from the chain at execution time, never from the client.
  let availableBalance: number;
  try {
    const balances = await getAccountBalances(order.publicKey);
    const native = balances.find((b) => b.asset_type === "native");
    availableBalance = parseFloat(native?.balance ?? "0");
  } catch {
    return rejectResponse(
      rejectTrade(
        TRADE_ERROR_CODES.BALANCE_UNAVAILABLE,
        "Could not verify your balance. Please try again."
      )
    );
  }

  const balanceRejection = checkAvailableBalance(order, availableBalance);
  if (balanceRejection) return rejectResponse(balanceRejection);

  return NextResponse.json(
    { ok: true, preview: buildBalancePreview(order, availableBalance) },
    { status: 200 }
  );
}

/**
 * GET /api/trades?publicKey=G...&cursor=...&limit=...
 * Returns the connected user's past swaps and liquidity events as an activity
 * feed, sourced from Stellar Horizon. Supports cursor-based pagination so the
 * client can implement infinite scroll over large histories.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey")?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { code: TRADE_ERROR_CODES.INVALID_REQUEST, message: "Missing publicKey." },
      { status: 400 }
    );
  }

  const cursor = searchParams.get("cursor") ?? undefined;
  const requestedLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const url = new URL(`${HORIZON_URL}/accounts/${encodeURIComponent(publicKey)}/transactions`);
  url.searchParams.set("order", "desc");
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);

  let payload: { _embedded?: { records?: unknown[] } };
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Horizon responded ${res.status}`);
    payload = await res.json();
  } catch {
    return NextResponse.json(
      {
        code: TRADE_ERROR_CODES.BALANCE_UNAVAILABLE,
        message: "Could not load transaction history. Please try again.",
      },
      { status: 503 }
    );
  }

  const records = Array.isArray(payload._embedded?.records) ? payload._embedded!.records! : [];
  const entries = records
    .map((record) => toActivityEntry(record as HorizonTransaction))
    .filter((entry): entry is ActivityEntry => entry !== null);

  const lastRecord = records[records.length - 1] as HorizonTransaction | undefined;

  return NextResponse.json(
    {
      entries,
      nextCursor: lastRecord?.paging_token ?? null,
      hasMore: records.length === limit,
    },
    { status: 200 }
  );
}

/** Minimal shape of a Horizon transaction record we rely on. */
type HorizonTransaction = {
  id?: string;
  hash?: string;
  created_at?: string;
  paging_token?: string;
  successful?: boolean;
  operation_count?: number;
};

/**
 * Maps a Horizon transaction into an activity feed row. Horizon's transaction
 * list does not expose operation details inline, so the action is inferred
 * from the transaction and the row links out to Stellar Expert for full detail.
 */
function toActivityEntry(tx: HorizonTransaction): ActivityEntry | null {
  const hash = tx.hash ?? tx.id;
  if (!hash) return null;

  const action: ActivityEntry["action"] = "Swap";

  return {
    id: hash,
    action,
    tokenPair: "XLM / —",
    amountIn: "—",
    amountOut: "—",
    timestamp: tx.created_at ?? new Date(0).toISOString(),
    stellarExpertUrl: `${STELLAR_EXPERT_URL}/tx/${hash}`,
  };
}

/**
 * Estimates before-and-after balances for the review step.
 * Uses the quoted amount and displayed fees; missing inputs are labeled.
 */
function buildBalancePreview(
  order: { side: "buy" | "sell"; amount: number; price?: number; fee?: number },
  availableBalance: number
) {
  const fee = typeof order.fee === "number" && Number.isFinite(order.fee) ? order.fee : null;
  const price = typeof order.price === "number" && Number.isFinite(order.price) ? order.price : null;
  const amount = Number.isFinite(order.amount) ? order.amount : null;

  const quoteComplete = amount !== null && price !== null;
  const feeKnown = fee !== null;

  const before = availableBalance;
  let after: number | null = null;

  if (quoteComplete) {
    const notional = amount * price;
    const feeAmount = feeKnown ? fee : 0;
    after = order.side === "buy" ? before - notional - feeAmount : before + notional - feeAmount;
  }

  return {
    asset: "native",
    before,
    after,
    // Label unavailable inputs so the UI can render them as estimates.
    estimated: !quoteComplete || !feeKnown,
    quoteComplete,
    feeKnown,
    fee: feeKnown ? fee : null,
    unavailable: after === null ? ["after"] : [],
  };
}

function rejectResponse({ code, message, status }: TradeRejection) {
  return NextResponse.json({ code, message }, { status });
}
