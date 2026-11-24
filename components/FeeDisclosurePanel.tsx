import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeeDisclosurePanelProps {
  /** Trade total in USDC — used to show concrete fee impact */
  tradeTotal?: number;
  className?: string;
  /**
   * Performance-comparison mode. When provided, the panel shows gross vs
   * fee-adjusted return assumptions instead of the trade-fee breakdown.
   */
  performance?: PerformanceFeeComparison;
}

export interface PerformanceFeeComparison {
  /** Gross return as a fraction, e.g. 0.12 for 12% */
  grossReturn?: number | null;
  /** Fee-adjusted return as a fraction, e.g. 0.11 for 11% */
  adjustedReturn?: number | null;
  /** Fee inputs that were available for the adjustment */
  availableInputs?: string[];
  /** Fee inputs that were required but missing */
  missingInputs?: string[];
}

const PLATFORM_FEE_RATE = 0.001; // 0.1%
const PROVIDER_SHARE = 0.5; // 50% of fee goes to signal provider

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return `${(value * 100).toFixed(2)}%`;
}
=======

/**
 * Explains the 0.1% platform fee and provider reward split in plain language.
 * Designed to be embedded inside TradeModal during trade confirmation.
 */
export function FeeDisclosurePanel({
  tradeTotal = 0,
  className,
  performance,
}: FeeDisclosurePanelProps) {
  const totalFee = tradeTotal * PLATFORM_FEE_RATE;
  const providerReward = totalFee * PROVIDER_SHARE;
  const platformRevenue = totalFee - providerReward;

  if (performance) {
    const availableInputs = performance.availableInputs ?? [];
    const missingInputs = performance.missingInputs ?? [];
    const isIncomplete = missingInputs.length > 0;
    const hasAdjusted =
      performance.adjustedReturn !== null &&
      performance.adjustedReturn !== undefined &&
      Number.isFinite(performance.adjustedReturn);

    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-surface-high px-4 py-3 text-sm",
          className
        )}
        aria-label="Fee-adjusted performance disclosure"
      >
        <div className="flex items-center gap-1.5 mb-2 text-foreground-muted font-medium">
          <Info size={13} aria-hidden="true" />
          <span>Gross vs fee-adjusted returns</span>
        </div>

        <ul className="space-y-1.5 text-xs text-foreground-muted">
          <li className="flex justify-between">
            <span>Gross return</span>
            <span className="font-mono font-medium text-foreground">
              {formatPercent(performance.grossReturn)}
            </span>
          </li>
          <li className="flex justify-between">
            <span>Fee-adjusted return</span>
            <span className="font-mono font-medium text-foreground">
              {hasAdjusted ? formatPercent(performance.adjustedReturn) : "Unavailable"}
            </span>
          </li>
        </ul>

        <div className="mt-2.5 text-xs text-foreground-subtle leading-relaxed">
          <p className="font-medium text-foreground-muted">Assumptions</p>
          <p>
            Adjusted returns apply the 0.1% platform fee per trade. Gross returns
            exclude all fees. Values are shown over the same period.
          </p>
          {availableInputs.length > 0 && (
            <p className="mt-1.5">
              Fee inputs used: {availableInputs.join(", ")}.
            </p>
          )}
        </div>

        {isIncomplete && (
          <p
            className="mt-2.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground-muted"
            role="note"
          >
            Incomplete fee data: {missingInputs.join(", ")} unavailable. The
            fee-adjusted return may be incomplete or unavailable.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-high px-4 py-3 text-sm",
        className
      )}
      aria-label="Fee and reward disclosure"
    >
      <div className="flex items-center gap-1.5 mb-2 text-foreground-muted font-medium">
        <Info size={13} aria-hidden="true" />
        <span>Fees &amp; rewards</span>
      </div>

      <ul className="space-y-1.5 text-xs text-foreground-muted">
        <li className="flex justify-between">
          <span>Platform fee</span>
          <span className="font-mono font-medium text-foreground">
            0.1%{tradeTotal > 0 ? ` ($${totalFee.toFixed(4)})` : ""}
          </span>
        </li>
        <li className="flex justify-between">
          <span>Signal provider reward (50%)</span>
          <span className="font-mono font-medium text-foreground">
            {tradeTotal > 0 ? `$${providerReward.toFixed(4)}` : "50% of fee"}
          </span>
        </li>
        <li className="flex justify-between">
          <span>Platform revenue (50%)</span>
          <span className="font-mono font-medium text-foreground">
            {tradeTotal > 0 ? `$${platformRevenue.toFixed(4)}` : "50% of fee"}
          </span>
        </li>
      </ul>

      <p className="mt-2.5 text-xs text-foreground-subtle leading-relaxed">
        A 0.1% fee is applied to each trade. Half goes directly to the signal
        provider as a reward for accurate signals; the other half supports
        platform operations. Network fees are charged separately by the Stellar
        network.
      </p>
    </div>
  );
}
