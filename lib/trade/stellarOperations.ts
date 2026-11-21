/**
 * Stellar operation summariser (#1104).
 *
 * Converts the raw operation objects from @stellar/stellar-sdk into a
 * display-ready shape that lists purpose, asset(s) and amount for each
 * operation in a trade transaction. Unsupported operation types are surfaced
 * as an `unknown` row so they are never silently hidden from the user.
 *
 * The input is the plain JS operation produced by the SDK's
 * TransactionBuilder / TransactionBuilder.fromXDR — it is NOT the XDR type
 * directly, so this module has no runtime dependency on stellar-sdk itself.
 */

// ── Asset representation ──────────────────────────────────────────────────────

/**
 * Minimal shape of a Stellar Asset as returned by the SDK's
 * operation-deserialisation helpers. The `issuer` field is absent for the
 * native asset (XLM).
 */
export interface SdkAsset {
  code: string;
  issuer?: string;
}

/** How an asset should be shown in the operations list. */
export interface OperationAsset {
  /** Asset code, e.g. "XLM" or "USDC". */
  code: string;
  /** Issuer G… address, or null for the native asset. */
  issuer: string | null;
}

function assetFromSdk(a: SdkAsset): OperationAsset {
  return {
    code: a.code,
    issuer: a.issuer ?? null,
  };
}

/** Returns a short label like "XLM" or "USDC (GA5ZSE…)" */
export function formatAsset(asset: OperationAsset, maxIssuerLen = 8): string {
  if (!asset.issuer) return asset.code;
  const short =
    asset.issuer.length > maxIssuerLen + 1
      ? `${asset.issuer.slice(0, maxIssuerLen)}…`
      : asset.issuer;
  return `${asset.code} (${short})`;
}

// ── Operation rows ────────────────────────────────────────────────────────────

/** An operation whose type, asset(s) and amount we can fully describe. */
export interface KnownOperationRow {
  kind: "known";
  /** Short human-readable label for the operation type. */
  label: string;
  /** Primary asset involved (asset sent, sold, or the main subject). */
  asset: OperationAsset;
  /** Amount for the primary asset, formatted as a decimal string. */
  amount: string | null;
  /** Secondary asset, e.g. the asset received in a path-payment swap. */
  destAsset?: OperationAsset;
  /** Amount received / destination amount, when applicable. */
  destAmount?: string | null;
  /** Raw operation type, e.g. "payment". */
  type: string;
}

/**
 * An operation type the app doesn't recognise. It is shown with a warning so
 * users know an unexpected operation exists — it is never silently dropped.
 */
export interface UnknownOperationRow {
  kind: "unknown";
  /** Raw operation type string from the SDK. */
  type: string;
}

export type OperationRow = KnownOperationRow | UnknownOperationRow;

// ── Summariser ────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Accepts a raw SDK operation object (the plain-JS value from
 * `transaction.operations[n]`) and returns a display-ready row.
 */
export function summariseOperation(op: Record<string, any>): OperationRow {
  const type: string = typeof op.type === "string" ? op.type : "unknown";

  switch (type) {
    case "payment":
      return {
        kind: "known",
        label: "Payment",
        type,
        asset: assetFromSdk(op.asset),
        amount: op.amount ?? null,
      };

    case "pathPaymentStrictSend":
      return {
        kind: "known",
        label: "Path payment (exact send)",
        type,
        asset: assetFromSdk(op.sendAsset),
        amount: op.sendAmount ?? null,
        destAsset: assetFromSdk(op.destAsset),
        destAmount: op.destMin ?? null,
      };

    case "pathPaymentStrictReceive":
      return {
        kind: "known",
        label: "Path payment (exact receive)",
        type,
        asset: assetFromSdk(op.sendAsset),
        amount: op.sendMax ?? null,
        destAsset: assetFromSdk(op.destAsset),
        destAmount: op.destAmount ?? null,
      };

    case "manageSellOffer":
      return {
        kind: "known",
        label:
          op.offerId && op.offerId !== "0"
            ? "Update sell offer"
            : "Create sell offer",
        type,
        asset: assetFromSdk(op.selling),
        amount: op.amount ?? null,
        destAsset: assetFromSdk(op.buying),
      };

    case "manageBuyOffer":
      return {
        kind: "known",
        label:
          op.offerId && op.offerId !== "0"
            ? "Update buy offer"
            : "Create buy offer",
        type,
        asset: assetFromSdk(op.buying),
        amount: op.buyAmount ?? null,
        destAsset: assetFromSdk(op.selling),
      };

    case "createPassiveSellOffer":
      return {
        kind: "known",
        label: "Create passive sell offer",
        type,
        asset: assetFromSdk(op.selling),
        amount: op.amount ?? null,
        destAsset: assetFromSdk(op.buying),
      };

    case "changeTrust":
      return {
        kind: "known",
        label: op.limit === "0" ? "Remove trustline" : "Add trustline",
        type,
        asset: assetFromSdk(op.line),
        amount: null,
      };

    case "createAccount":
      return {
        kind: "known",
        label: "Create account",
        type,
        asset: { code: "XLM", issuer: null },
        amount: op.startingBalance ?? null,
      };

    case "accountMerge":
      return {
        kind: "known",
        label: "Merge account",
        type,
        asset: { code: "XLM", issuer: null },
        amount: null,
      };

    case "claimClaimableBalance":
      return {
        kind: "known",
        label: "Claim claimable balance",
        type,
        asset: { code: "—", issuer: null },
        amount: null,
      };

    case "createClaimableBalance":
      return {
        kind: "known",
        label: "Create claimable balance",
        type,
        asset: assetFromSdk(op.asset),
        amount: op.amount ?? null,
      };

    case "liquidityPoolDeposit":
      return {
        kind: "known",
        label: "Liquidity pool deposit",
        type,
        asset: { code: "Pool shares", issuer: null },
        amount: null,
      };

    case "liquidityPoolWithdraw":
      return {
        kind: "known",
        label: "Liquidity pool withdrawal",
        type,
        asset: { code: "Pool shares", issuer: null },
        amount: null,
      };

    case "invokeHostFunction":
      return {
        kind: "known",
        label: "Invoke contract function",
        type,
        asset: { code: "—", issuer: null },
        amount: null,
      };

    case "extendFootprintTtl":
      return {
        kind: "known",
        label: "Extend footprint TTL",
        type,
        asset: { code: "—", issuer: null },
        amount: null,
      };

    case "restoreFootprint":
      return {
        kind: "known",
        label: "Restore footprint",
        type,
        asset: { code: "—", issuer: null },
        amount: null,
      };

    default:
      return { kind: "unknown", type };
  }
}

/**
 * Maps an array of raw SDK operations to display rows.
 * Returns at least one row even when the array is empty (the caller decides
 * how to handle that case).
 */
export function summariseOperations(
  ops: Array<Record<string, any>>
): OperationRow[] {
  if (!Array.isArray(ops) || ops.length === 0) return [];
  return ops.map(summariseOperation);
}
