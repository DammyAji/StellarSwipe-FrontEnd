"use client";

/**
 * StellarOperationList (#1104)
 *
 * Shows each operation in a multi-operation Stellar trade transaction before
 * the wallet signing prompt. Purpose, asset, and amount are shown for every
 * recognised operation. Unsupported or unexpected operations are listed with
 * a warning rather than being hidden.
 *
 * Loading, empty, and error states follow the same visual patterns used
 * elsewhere in the trade review (skeleton text, amber alert, muted empty
 * copy). Keyboard-navigable: the list is a semantic <ul> and uses
 * aria-live for async state changes.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatAsset,
  summariseOperations,
  type OperationRow,
} from "@/lib/trade/stellarOperations";

// ── Public types ─────────────────────────────────────────────────────────────

/** A raw SDK operation object — the value of `transaction.operations[n]`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SdkOperation = Record<string, any>;

export interface StellarOperationListProps {
  /**
   * Array of raw SDK operation objects from the pending transaction.
   * Pass `undefined` or omit while loading.
   */
  operations?: SdkOperation[] | null;
  /** True while operations are still being fetched or decoded. */
  loading?: boolean;
  /** Set when operations could not be loaded or decoded. */
  error?: string | null;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StellarOperationList({
  operations,
  loading = false,
  error = null,
  className,
}: StellarOperationListProps) {
  return (
    <section
      aria-labelledby="stellar-ops-heading"
      aria-live="polite"
      aria-busy={loading}
      className={cn("space-y-2", className)}
    >
      <h2
        id="stellar-ops-heading"
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Transaction operations
      </h2>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (!operations || operations.length === 0) && (
        <EmptyState />
      )}
      {!loading && !error && operations && operations.length > 0 && (
        <OperationRows operations={operations} />
      )}
    </section>
  );
}

// ── Sub-states ────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading operations"
      className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      <span>Loading transaction operations…</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {message || "Operations could not be loaded. Verify the transaction in your wallet before signing."}
      </span>
    </p>
  );
}

function EmptyState() {
  return (
    <p className="rounded-xl border p-3 text-sm text-muted-foreground">
      No operations found in this transaction.
    </p>
  );
}

// ── Operation rows ────────────────────────────────────────────────────────────

function OperationRows({ operations }: { operations: SdkOperation[] }) {
  const rows = summariseOperations(operations);

  return (
    <ul
      aria-label="Transaction operations"
      className="divide-y rounded-xl border text-sm"
    >
      {rows.map((row, i) => (
        // Index is stable because operations don't reorder after decode.
        // eslint-disable-next-line react/no-array-index-key
        <OperationRowItem key={i} row={row} index={i} total={rows.length} />
      ))}
    </ul>
  );
}

function OperationRowItem({
  row,
  index,
  total,
}: {
  row: OperationRow;
  index: number;
  total: number;
}) {
  const position = `Operation ${index + 1} of ${total}`;

  if (row.kind === "unknown") {
    return (
      <li
        aria-label={`${position}: unrecognised operation type "${row.type}"`}
        className="space-y-1 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Unknown operation</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {row.type}
          </span>
        </div>
        <p
          role="note"
          className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle
            className="mt-0.5 h-3 w-3 shrink-0"
            aria-hidden="true"
          />
          <span>
            This operation type is not recognised. Review it carefully in your
            wallet before signing.
          </span>
        </p>
      </li>
    );
  }

  const { label, asset, amount, destAsset, destAmount } = row;
  const assetLabel = formatAsset(asset);
  const isSwap = destAsset !== undefined;

  const accessibleLabel = [
    position,
    label,
    amount ? `${amount} ${asset.code}` : asset.code,
    isSwap && destAsset
      ? `to ${destAmount ? `${destAmount} ` : ""}${destAsset.code}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li aria-label={accessibleLabel} className="p-3 space-y-1.5">
      {/* Operation label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1}/{total}
        </span>
      </div>

      {/* Asset / amount grid */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {isSwap ? (
          <>
            <dt className="text-muted-foreground">Send</dt>
            <dd className="text-right font-mono">
              {amount ? `${amount} ` : ""}
              <AssetCode asset={asset} />
            </dd>

            {destAsset && (
              <>
                <dt className="text-muted-foreground">
                  {row.type === "pathPaymentStrictReceive"
                    ? "Receive (exact)"
                    : row.type === "pathPaymentStrictSend"
                    ? "Receive (min)"
                    : "Buy"}
                </dt>
                <dd className="text-right font-mono">
                  {destAmount ? `${destAmount} ` : ""}
                  <AssetCode asset={destAsset} />
                </dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Asset</dt>
            <dd className="text-right font-mono">
              <AssetCode asset={asset} />
            </dd>

            {amount !== null && (
              <>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="text-right font-mono tabular-nums">{amount}</dd>
              </>
            )}
          </>
        )}
      </dl>

      {/* Issuer note — always shown so users can compare with their wallet */}
      {asset.issuer && (
        <p className="text-[11px] text-muted-foreground break-all">
          <span className="font-medium">Issuer:</span>{" "}
          <span
            className="font-mono select-all"
            title={asset.issuer}
            aria-label={`${asset.code} issuer address`}
          >
            {asset.issuer}
          </span>
        </p>
      )}
      {isSwap && destAsset?.issuer && (
        <p className="text-[11px] text-muted-foreground break-all">
          <span className="font-medium">{destAsset.code} issuer:</span>{" "}
          <span
            className="font-mono select-all"
            title={destAsset.issuer}
            aria-label={`${destAsset.code} issuer address`}
          >
            {destAsset.issuer}
          </span>
        </p>
      )}
    </li>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function AssetCode({
  asset,
}: {
  asset: { code: string; issuer: string | null };
}) {
  return (
    <span title={asset.issuer ?? undefined} aria-label={formatAsset(asset)}>
      {asset.code}
    </span>
  );
}
