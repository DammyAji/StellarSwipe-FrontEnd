"use client";

import { AlertTriangle, Check, Copy, Globe2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";
import {
  getIssuerStatus,
  getNetworkLabel,
  getRecentIssuerMetadataChanges,
  groupAddress,
  shortenAddress,
  ISSUER_METADATA_FIELD_LABELS,
  type IssuerMetadataHistory,
  type TradeAssetInfo,
} from "@/lib/assetIssuer";
import {
  formatAbsoluteTimestamp,
  formatRelativeTimestamp,
  toDate,
} from "@/lib/timestampUtils";

export interface AssetIssuerSide {
  /** Which side of the trade, e.g. "You pay" / "You receive". */
  label: string;
  asset: TradeAssetInfo;
  /** Issuer metadata snapshots for this asset, when available (#1085). */
  metadataHistory?: IssuerMetadataHistory | null;
  /** True while metadata history is still being fetched. */
  metadataHistoryLoading?: boolean;
  /** Set when metadata history could not be loaded. */
  metadataHistoryError?: string | null;
}

export interface AssetIssuerDetailsProps {
  sides: AssetIssuerSide[];
  /** Network the trade will be submitted to (e.g. "TESTNET"). */
  network: string;
  className?: string;
}

/**
 * AssetIssuerDetails (#806)
 *
 * Shows asset code, issuer address and network for each side of a trade so
 * users can verify the exact asset before signing. Missing or malformed
 * issuer metadata is called out as a warning but never disables anything —
 * the surrounding review keeps all of its actions available.
 */
export function AssetIssuerDetails({
  sides,
  network,
  className,
}: AssetIssuerDetailsProps) {
  const networkLabel = getNetworkLabel(network);

  return (
    <section
      aria-labelledby="asset-issuer-heading"
      className={cn("space-y-2", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="asset-issuer-heading"
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Asset verification
        </h2>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          data-testid="asset-network-badge"
        >
          <Globe2 className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Network: </span>
          {networkLabel}
        </span>
      </div>
      <ul className="rounded-xl border divide-y text-sm">
        {sides.map((side) => (
          <AssetIssuerRow
            key={side.label}
            side={side}
            networkLabel={networkLabel}
          />
        ))}
      </ul>
    </section>
  );
}

function AssetIssuerRow({
  side,
  networkLabel,
}: {
  side: AssetIssuerSide;
  networkLabel: string;
}) {
  const { asset, label } = side;
  const status = getIssuerStatus(asset);
  const issuer = asset.issuer?.trim() ?? "";
  const { copied, status: copyStatus, copy } = useClipboard();
  const isCopyError = copyStatus === "error";

  return (
    <li
      className="space-y-1.5 p-3"
      aria-label={`${label}: ${asset.code}`}
      data-issuer-status={status}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{asset.code}</span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Issuer</dt>
        <dd className="flex min-w-0 items-center justify-end gap-1.5">
          {status === "native" && (
            <span>Native asset (no issuer)</span>
          )}
          {(status === "known" || status === "invalid") && (
            <>
              <span
                className="truncate font-mono select-all"
                title={issuer}
                aria-label={`Issuer address ${groupAddress(issuer)}`}
              >
                {shortenAddress(issuer)}
              </span>
              <button
                type="button"
                onClick={() => copy(issuer)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  copied
                    ? "Issuer address copied"
                    : isCopyError
                    ? "Copy failed — select the address to copy manually"
                    : `Copy ${asset.code} issuer address`
                }
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                ) : isCopyError ? (
                  <AlertTriangle
                    className="h-3 w-3 text-yellow-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
              <span role="status" aria-live="polite" className="sr-only">
                {copied ? "Issuer address copied to clipboard" : ""}
              </span>
              {isCopyError && (
                <span role="alert" className="sr-only">
                  Copy failed. Select the issuer address to copy it manually.
                </span>
              )}
            </>
          )}
          {status === "missing" && (
            <span className="text-amber-600 dark:text-amber-400">
              Not available
            </span>
          )}
        </dd>

        {asset.homeDomain && (
          <>
            <dt className="text-muted-foreground">Home domain</dt>
            <dd className="text-right font-mono">{asset.homeDomain}</dd>
          </>
        )}

        <dt className="text-muted-foreground">Network</dt>
        <dd className="text-right">{networkLabel}</dd>
      </dl>

      {copyStatus !== "idle" && (
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Issuer address copied" : "Copy failed — copy the address manually"}
        </p>
      )}

      {(status === "missing" || status === "invalid") && (
        <p
          role="note"
          className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {status === "missing"
              ? `Issuer details for ${asset.code} are unavailable. Verify the asset in your wallet before signing.`
              : `The issuer for ${asset.code} is not a valid Stellar address. Verify the asset in your wallet before signing.`}
          </span>
        </p>
      )}

      <IssuerMetadataChanges
        assetCode={asset.code}
        history={side.metadataHistory}
        loading={side.metadataHistoryLoading}
        error={side.metadataHistoryError}
      />
    </li>
  );
}

/**
 * Recent issuer metadata changes (#1085).
 *
 * Summarizes the last change to the issuer-provided name, image or
 * description. The canonical identity (code + issuer + network) above stays
 * the source of truth: this block is explicitly labelled as issuer-provided
 * and never claims a value when history is missing or failed to load.
 */
function IssuerMetadataChanges({
  assetCode,
  history,
  loading,
  error,
}: {
  assetCode: string;
  history?: IssuerMetadataHistory | null;
  loading?: boolean;
  error?: string | null;
}) {
  const headingId = `issuer-metadata-heading-${assetCode}`;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        <span>Checking issuer metadata history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-xs text-destructive">
        Issuer metadata history for {assetCode} could not be loaded. Recent
        changes are unknown.
      </p>
    );
  }

  const changes = getRecentIssuerMetadataChanges(history);
  const updatedAt = toDate(changes[0]?.updatedAt);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-1 rounded-lg border bg-muted/30 px-2 py-1.5"
      data-testid="issuer-metadata-changes"
    >
      <h3
        id={headingId}
        className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Recent issuer metadata changes
      </h3>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recorded changes to issuer-provided metadata for {assetCode}.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Issuer-provided details changed{" "}
            {updatedAt ? (
              <time
                dateTime={updatedAt.toISOString()}
                title={formatAbsoluteTimestamp(updatedAt)}
              >
                {formatRelativeTimestamp(updatedAt)}
              </time>
            ) : (
              "at an unknown time"
            )}
            . Asset identity above is unchanged.
          </p>
          <ul className="space-y-1 text-xs">
            {changes.map((change) => (
              <li key={change.field} className="flex flex-wrap gap-x-1.5">
                <span className="font-medium">
                  {ISSUER_METADATA_FIELD_LABELS[change.field]}:
                </span>
                <span className="break-all text-muted-foreground line-through">
                  {change.previous ?? "not set"}
                </span>
                <span aria-hidden="true">→</span>
                <span className="sr-only">changed to</span>
                <span className="break-all">{change.current ?? "removed"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
