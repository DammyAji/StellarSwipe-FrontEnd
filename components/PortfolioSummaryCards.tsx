"use client";

import { Card, CardContent } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePrivacyStore, PRIVACY_MASK } from "@/store/usePrivacyStore";
import { TrendingUp, TrendingDown, Wallet, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortfolioEmptyState } from "@/components/PortfolioEmptyState";
import { XlmBalanceBreakdown } from "@/components/XlmBalanceBreakdown";
import { PortfolioWalletFilter } from "@/components/PortfolioWalletFilter";
import { filterAssetsByWallet } from "@/store/usePortfolioStore";
import { formatCurrency } from "@/lib/localeFormatter";

/**
 * Renders a summary value so it reflows on narrow screens instead of clipping:
 * the value wraps at any character boundary and exposes the full, unrounded
 * figure via a precision disclosure (title + accessible description).
 */
function SummaryValue({
  value,
  precise,
  className,
  label,
  hidden,
}: {
  value: string;
  precise: string;
  className?: string;
  label: string;
  hidden?: boolean;
}) {
  return (
    <p
      className={cn(
        "min-w-0 break-words text-sm font-semibold leading-tight [overflow-wrap:anywhere]",
        className
      )}
      title={hidden ? undefined : precise}
      aria-label={hidden ? `${label} hidden` : undefined}
    >
      {value}
      {!hidden && precise !== value && (
        <span className="sr-only"> (full precision: {precise})</span>
      )}
    </p>
  );
}

export function PortfolioSummaryCards() {
  const {
    assets: allAssets,
    totalRealizedPnL,
    totalUnrealizedPnL,
    isLoading,
    walletFilter,
    setWalletFilter,
    connectedWallets,
  } = usePortfolio();
  const { privacyMode } = usePrivacyStore();

  const assets = filterAssetsByWallet(allAssets, walletFilter);
  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);

  // Empty state: no assets and not mid-load
  if (!isLoading && assets.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-0">
          {walletFilter ? (
            <PortfolioEmptyState
              variant="summary"
              heading="No holdings for this wallet"
              body="This wallet has no holdings in the current portfolio data. Try another wallet or show all wallets."
              ctaLabel="Show all wallets"
              ctaHref="#"
              onCtaClick={() => setWalletFilter(null)}
            />
          ) : (
            <PortfolioEmptyState variant="summary" />
          )}
        </CardContent>
      </Card>
    );
  }

  const totalPnL = totalRealizedPnL + totalUnrealizedPnL;
  const pnlPercent = totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;
  const isPositive = totalPnL >= 0;
  const activePositions = assets.filter((a) => a.value > 0).length;

  // Determine if any quotes are stale (older than 5 minutes)
  const hasStaleQuotes = assets.some((asset) => {
    const lastUpdated = asset.quoteLastUpdated;
    if (!lastUpdated) return false;
    const age = Date.now() - new Date(lastUpdated).getTime();
    return age > 5 * 60 * 1000; // 5 minutes
  });

  /** Mask a numeric string if privacy mode is on. */
  const mask = (v: string) => (privacyMode ? PRIVACY_MASK : v);

  const stats = [
    {
      label: "Balance",
      value: mask(formatCurrency(totalValue)),
      precise: mask(
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }).format(totalValue)
      ),
      icon: Wallet,
      className: "text-accent-sky",
    },
    {
      label: "Total P/L",
      value: mask(`${isPositive ? "+" : ""}$${Math.abs(totalPnL).toFixed(2)}`),
      precise: mask(
        `${isPositive ? "+" : "-"}$${Math.abs(totalPnL).toFixed(8)}`
      ),
      sub: mask(`${isPositive ? "+" : ""}${pnlPercent.toFixed(2)}%`),
      icon: isPositive ? TrendingUp : TrendingDown,
      className: isPositive ? "text-accent-success" : "text-accent-danger",
    },
    {
      label: "Positions",
      value: String(activePositions),
      precise: String(activePositions),
      sub: `${assets.length} asset${assets.length !== 1 ? "s" : ""}`,
      icon: BarChart2,
      className: "text-accent-market",
    },
  ];

  return (
    <Card className="w-full">
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Portfolio snapshot
        </p>
        <PortfolioWalletFilter
          className="mb-3"
          wallets={connectedWallets}
          value={walletFilter}
          onChange={setWalletFilter}
        />
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
          {stats.map(({ label, value, precise, sub, icon: Icon, className }) => (
            <div key={label} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon size={13} className={cn("shrink-0", className)} aria-hidden="true" />
                <span className="min-w-0 break-words text-[11px] text-muted-foreground">
                  {label}
                </span>
              </div>
              <SummaryValue
                value={value}
                precise={precise}
                className={className}
                label={label}
                hidden={privacyMode}
              />
              {sub && (
                <p className="min-w-0 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                  {sub}
                </p>
              )}
            </div>
          ))}
        </div>

        <XlmBalanceBreakdown
          totalXlm={xlmAsset?.value ?? null}
          subentryCount={xlmAsset?.subentryCount ?? null}
          isLoading={isLoading}
          privacyMode={privacyMode}
        />

        {/* Quote status overlay */}
        {hasStaleQuotes && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-sm">
            <span className="text-amber-300 font-medium">
              Some quotes are stale (older than 5 minutes).{" "}
            </span>
            <span className="text-amber-400 ml-2">Refresh portfolio to update prices.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
