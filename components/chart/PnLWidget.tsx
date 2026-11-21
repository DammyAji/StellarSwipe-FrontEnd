"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePrivacyStore, PRIVACY_MASK } from "@/store/usePrivacyStore";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortfolioEmptyState } from "@/components/PortfolioEmptyState";
import { ProfitLossStatus } from "@/components/ProfitLossStatus";

export function PnLWidget() {
  const { totalRealizedPnL, totalUnrealizedPnL, totalValue, isLoading, assets } = usePortfolio();
  const { privacyMode } = usePrivacyStore();

  const totalPnL = totalRealizedPnL + totalUnrealizedPnL;
  const portfolioReturn =
    totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;
  const isPositive = totalPnL >= 0;
  const isPositiveRealized = totalRealizedPnL >= 0;
  const isPositiveUnrealized = totalUnrealizedPnL >= 0;

  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n: number) => (n >= 0 ? "+" : "");

  /** Mask a string if privacy mode is on. */
  const mask = (v: string) => (privacyMode ? PRIVACY_MASK : v);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">P&amp;L Overview</h2>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading P&amp;L data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state: no assets yet
  if (!assets || assets.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">P&amp;L Overview</h2>
        </CardHeader>
        <CardContent className="p-0">
          <PortfolioEmptyState variant="pnl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">P&amp;L Overview</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          Visually hidden summary table so screen-reader users can access
          all values without having to navigate the visual card layout.
        */}
        <table className="sr-only" aria-label="P&L summary">
          <tbody>
            <tr>
              <th scope="row">Total P&L</th>
              <td>{mask(`${sign(totalPnL)}${fmtCurrency(totalPnL)}`)}</td>
            </tr>
            <tr>
              <th scope="row">Portfolio return</th>
              <td>{mask(`${sign(portfolioReturn)}${portfolioReturn.toFixed(2)}%`)}</td>
            </tr>
            <tr>
              <th scope="row">Realized P&L</th>
              <td>{mask(`${sign(totalRealizedPnL)}${totalRealizedPnL.toLocaleString()}`)}</td>
            </tr>
            <tr>
              <th scope="row">Unrealized P&L</th>
              <td>{mask(`${sign(totalUnrealizedPnL)}${totalUnrealizedPnL.toLocaleString()}`)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total P&L with indicator */}
        <div
          className={cn(
            "rounded-lg p-4",
            isPositive ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {isPositive ? (
              <TrendingUp size={18} className="text-green-600" aria-hidden="true" />
            ) : (
              <TrendingDown size={18} className="text-red-600" aria-hidden="true" />
            )}
            <p className="text-sm text-muted-foreground">Total P&amp;L</p>
          </div>
          <p
            className={cn(
              "text-2xl font-bold",
              isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {mask(`${isPositive ? "+" : ""}${totalPnL.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`)}
          </p>
          <ProfitLossStatus value={totalPnL} masked={privacyMode} className="mt-2" />
        </div>

        {/* Portfolio Return Percentage */}
        <div
          className={cn(
            "rounded-lg p-4",
            isPositive ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          <p className="text-sm text-muted-foreground mb-2">Portfolio Return</p>
          <p
            className={cn(
              "text-2xl font-bold",
              isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {mask(`${isPositive ? "+" : ""}${portfolioReturn.toFixed(2)}%`)}
          </p>
          <ProfitLossStatus value={totalPnL} masked={privacyMode} className="mt-2" />
        </div>

        {/* Realized and Unrealized breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "rounded-lg p-3",
              isPositiveRealized ? "bg-green-500/10" : "bg-red-500/10"
            )}
          >
            <p className="text-xs text-muted-foreground mb-1">Realized P&amp;L</p>
            <p
              className={cn(
                "text-lg font-semibold",
                isPositiveRealized ? "text-green-600" : "text-red-600"
              )}
            >
              {mask(`${isPositiveRealized ? "+" : ""}${totalRealizedPnL.toLocaleString()}`)}
            </p>
            <ProfitLossStatus value={totalRealizedPnL} masked={privacyMode} className="mt-2" />
          </div>
          <div
            className={cn(
              "rounded-lg p-3",
              isPositiveUnrealized ? "bg-green-500/10" : "bg-red-500/10"
            )}
          >
            <p className="text-xs text-muted-foreground mb-1">Unrealized P&amp;L</p>
            <p
              className={cn(
                "text-lg font-semibold",
                isPositiveUnrealized ? "text-green-600" : "text-red-600"
              )}
            >
              {mask(`${isPositiveUnrealized ? "+" : ""}${totalUnrealizedPnL.toLocaleString()}`)}
            </p>
            <ProfitLossStatus value={totalUnrealizedPnL} masked={privacyMode} className="mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
