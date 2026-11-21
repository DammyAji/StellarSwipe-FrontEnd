"use client";

import { AlertTriangle, Check, Copy, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClipboard } from "@/hooks/useClipboard";
import {
  getIssuerStatus,
  getNetworkLabel,
  groupAddress,
  shortenAddress,
  type TradeAssetInfo,
} from "@/lib/assetIssuer";

export interface AssetIssuerSide {
  /** Which side of the trade, e.g. "You pay" / "You receive". */
  label: string;
  asset: TradeAssetInfo;
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
    </li>
  );
}
