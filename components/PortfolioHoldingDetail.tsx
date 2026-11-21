"use client";

/**
 * PortfolioHoldingDetail — #796
 *
 * Displays row-level cost basis, current value, and realized/unrealized P&L for
 * a single portfolio holding. Handles three data states:
 *   - complete: costBasis is a finite number
 *   - partial: costBasis is undefined (data unavailable)
 *   - empty: no realizedPnL / unrealizedPnL recorded yet
 *
 * Also surfaces the Stellar issuer's trustline authorization state (#1084).
 * Missing or unrecognised authorization data renders as a distinct "Unknown"
 * state that never implies the asset is tradeable.
 *
 * Accessible labels on every figure; works at narrow widths via a single-column
 * responsive grid.
 */

import { cn } from "@/lib/utils";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import type {
  PortfolioAsset,
  TrustlineAuthorizationState,
} from "@/store/usePortfolioStore";
import { usePrivacyStore, PRIVACY_MASK } from "@/store/usePrivacyStore";

interface PortfolioHoldingDetailProps {
  asset: PortfolioAsset;
  className?: string;
}

function formatUSD(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PnLCell({
  label,
  value,
  mask,
}: {
  label: string;
  value: number | undefined;
  mask: (v: string) => string;
}) {
  if (value === undefined) {
    return (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd
          className="text-right font-mono text-muted-foreground text-xs flex items-center justify-end gap-1"
          aria-label={`${label} unavailable`}
        >
          <AlertCircle size={11} aria-hidden="true" />
          No data
        </dd>
      </>
    );
  }

  const isPositive = value >= 0;
  const formatted = `${isPositive ? "+" : ""}${formatUSD(value)}`;

  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-mono flex items-center justify-end gap-1",
          isPositive ? "text-green-500" : "text-red-500"
        )}
        aria-label={`${label}: ${mask(formatted)}`}
      >
        {isPositive ? (
          <TrendingUp size={11} aria-hidden="true" />
        ) : (
          <TrendingDown size={11} aria-hidden="true" />
        )}
        {mask(formatted)}
      </dd>
    </>
  );
}

const TRUSTLINE_AUTHORIZATION_LABELS: Record<
  TrustlineAuthorizationState,
  string
> = {
  authorized: "Authorized",
  unauthorized: "Not authorized",
  "authorized-to-maintain-liabilities": "Authorized to maintain liabilities",
  unknown: "Unknown",
};

const TRUSTLINE_AUTHORIZATION_DESCRIPTIONS: Record<
  TrustlineAuthorizationState,
  string
> = {
  authorized: "The issuer has authorized this trustline.",
  unauthorized: "The issuer has not authorized this trustline.",
  "authorized-to-maintain-liabilities":
    "The issuer allows holding and closing this asset, but not acquiring more.",
  unknown:
    "Trustline authorization could not be determined. This does not confirm the asset can be traded.",
};

function TrustlineAuthorizationCell({
  state,
}: {
  state: TrustlineAuthorizationState | undefined;
}) {
  const resolved: TrustlineAuthorizationState = state ?? "unknown";
  const label = TRUSTLINE_AUTHORIZATION_LABELS[resolved];
  const description = TRUSTLINE_AUTHORIZATION_DESCRIPTIONS[resolved];
  const isUnknown = resolved === "unknown";

  return (
    <>
      <dt className="text-muted-foreground">Trustline authorization</dt>
      <dd
        className={cn(
          "text-right flex items-center justify-end gap-1",
          isUnknown
            ? "text-muted-foreground text-xs italic"
            : "text-foreground"
        )}
        aria-label={`Trustline authorization: ${label}. ${description}`}
        title={description}
      >
        {isUnknown && <AlertCircle size={11} aria-hidden="true" />}
        {label}
      </dd>
    </>
  );
}

export function PortfolioHoldingDetail({
  asset,
  className,
}: PortfolioHoldingDetailProps) {
  const { privacyMode } = usePrivacyStore();
  const mask = (v: string) => (privacyMode ? PRIVACY_MASK : v);

  const costBasisAvailable = typeof asset.costBasis === "number";

  return (
    <section
      aria-label={`${asset.name} holding detail`}
      className={cn(
        "rounded-lg border border-border bg-surface p-3 text-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: asset.color }}
          aria-hidden="true"
        />
        <h3 className="font-semibold text-foreground leading-tight">
          {asset.name}{" "}
          <span className="text-muted-foreground font-normal">
            ({asset.symbol})
          </span>
        </h3>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {/* Current value */}
        <dt className="text-muted-foreground">Current value</dt>
        <dd
          className="text-right font-mono text-foreground"
          aria-label={`Current value: ${mask(formatUSD(asset.value))}`}
        >
          {mask(formatUSD(asset.value))}
        </dd>

        {/* Allocation */}
        <dt className="text-muted-foreground">Allocation</dt>
        <dd
          className="text-right font-mono text-foreground"
          aria-label={`Allocation: ${asset.percentage.toFixed(1)} percent`}
        >
          {asset.percentage.toFixed(1)}%
        </dd>

        {/* Cost basis */}
        <dt className="text-muted-foreground">Cost basis</dt>
        {costBasisAvailable ? (
          <dd
            className="text-right font-mono text-foreground"
            aria-label={`Cost basis: ${mask(formatUSD(asset.costBasis!))}`}
          >
            {mask(formatUSD(asset.costBasis!))}
          </dd>
        ) : (
          <dd
            className="text-right font-mono text-muted-foreground text-xs flex items-center justify-end gap-1"
            aria-label="Cost basis unavailable"
          >
            <AlertCircle size={11} aria-hidden="true" />
            Unavailable
          </dd>
        )}

        {/* Trustline authorization */}
        <TrustlineAuthorizationCell state={asset.trustlineAuthorization} />

        {/* Realized P&L */}
        <PnLCell
          label="Realized P/L"
          value={asset.realizedPnL}
          mask={mask}
        />

        {/* Unrealized P&L */}
        <PnLCell
          label="Unrealized P/L"
          value={asset.unrealizedPnL}
          mask={mask}
        />
      </dl>
    </section>
  );
}
