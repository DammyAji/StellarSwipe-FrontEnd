"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { type ComparisonGranularity } from "@/lib/comparison";

export interface PriorPeriodSnapshot {
  pnl: number | null;
  winRate: number | null;
  totalTrades: number | null;
  granularity: ComparisonGranularity;
  capturedAt: Date;
}

/** A single point in a wallet's performance history. */
export interface WalletHistoryPoint {
  /** ISO timestamp or date string for the point. */
  timestamp: string;
  /** Portfolio value at the point, or null when history is unavailable. */
  value: number | null;
}

/** Raw per-wallet history as returned by the data source. */
export interface WalletHistory {
  walletId: string;
  /** Human-readable label for legends. */
  label?: string;
  points: WalletHistoryPoint[];
}

/** Aligned series for a single wallet across the shared date range. */
export interface AlignedWalletSeries {
  walletId: string;
  label: string;
  /** Values aligned to `timestamps`; null entries mean missing history (not zero). */
  values: (number | null)[];
  /** True when the wallet has at least one non-null value in range. */
  hasData: boolean;
}

/** Fee inputs required to compute fee-adjusted benchmark values. */
export interface FeeInputs {
  /** Fee rate as a fraction (e.g. 0.001 for 10 bps). */
  feeRate: number | null;
  /** Optional fixed fee per period, in the same unit as values. */
  fixedFee?: number | null;
}

/** Fee-adjusted benchmark series and disclosure metadata. */
export interface FeeAdjustedBenchmark {
  /** Gross (unadjusted) benchmark values aligned to `timestamps`. */
  gross: (number | null)[];
  /** Fee-adjusted benchmark values aligned to `timestamps`. */
  adjusted: (number | null)[];
  /** Assumptions used to derive adjusted values. */
  assumptions: {
    feeRate: number | null;
    fixedFee: number | null;
    description: string;
  };
  /** True when some fee inputs were missing and adjusted values are incomplete. */
  incomplete: boolean;
  /** Human-readable disclosure of missing/incomplete fee data. */
  disclosure: string | null;
}

export interface MultiWalletComparisonOptions {
  /** Connected wallet IDs to compare. */
  walletIds: string[];
  /** Inclusive start of the shared date range (ISO string). */
  startDate: string;
  /** Inclusive end of the shared date range (ISO string). */
  endDate: string;
  /** Optional fee inputs for fee-adjusted benchmark values. */
  feeInputs?: FeeInputs;
  /** Optional data source; defaults to a no-op that reports empty history. */
  fetchHistory?: (
    walletId: string,
    startDate: string,
    endDate: string
  ) => Promise<WalletHistory | null>;
}

export interface MultiWalletComparisonResult {
  /** Shared, sorted timestamps used to align all series. */
  timestamps: string[];
  /** Aligned per-wallet series (missing history omitted as null). */
  wallets: AlignedWalletSeries[];
  /** Fee-adjusted benchmark series, or null when no fee inputs are available. */
  benchmark: FeeAdjustedBenchmark | null;
  /** True while history is being fetched. */
  isLoading: boolean;
  /** True when no wallet has any data in the selected range. */
  isEmpty: boolean;
  /** Error message when fetching failed, otherwise null. */
  error: string | null;
}

/**
 * Hook that derives period-over-period comparison metrics from the portfolio store.
 *
 * Features:
 * - Gets current P&L, win rate, and total trades from the portfolio store
 * - Falls back to deterministic demo prior-period values (keyed by granularity)
 * - Supports optional external prior snapshot for real API integration
 * - Returns `isDemo` flag for UI badge display
 *
 * @param priorSnapshot Optional external prior period data (from API)
 * @returns Object containing current metrics, prior metrics, and metadata
 */
export function usePeriodComparison(priorSnapshot?: PriorPeriodSnapshot) {
  const { totalRealizedPnL, totalUnrealizedPnL, totalValue, assets } = usePortfolioStore();

  // Calculate current period metrics
  const currentPnl = totalRealizedPnL + totalUnrealizedPnL;
  const currentWinRate = useMemo(() => {
    // Simplified win rate calculation - in a real app this would come from trade history
    const winningTrades = assets.filter(a => (a.realizedPnL ?? 0) > 0).length;
    const totalTrades = assets.length;
    return totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  }, [assets]);
  const currentTotalTrades = assets.length;

  // If external prior snapshot is provided, use it
  if (priorSnapshot) {
    return {
      pnl: currentPnl,
      winRate: currentWinRate,
      totalTrades: currentTotalTrades,
      priorPnl: priorSnapshot.pnl,
      priorWinRate: priorSnapshot.winRate,
      priorTotalTrades: priorSnapshot.totalTrades,
      isDemo: false,
    };
  }

  // Fallback to deterministic demo prior values based on granularity
  // In a real implementation, this would fetch from an API endpoint
  const getDemoPriorValues = (granularity: ComparisonGranularity = "month") => {
    const baseValues = {
      pnl: currentPnl * 0.8, // 20% increase from prior
      winRate: Math.max(0, currentWinRate * 0.9), // 10% improvement from prior
      totalTrades: Math.max(1, currentTotalTrades - 2), // 2 more trades than prior
    };

    // Adjust demo values based on granularity for realism
    switch (granularity) {
      case "week":
        return {
          pnl: currentPnl * 0.95, // 5% increase from prior week
          winRate: Math.max(0, currentWinRate * 0.98), // 2% improvement
          totalTrades: Math.max(1, currentTotalTrades - 1), // 1 more trade
        };
      case "quarter":
        return {
          pnl: currentPnl * 0.7, // 30% increase from prior quarter
          winRate: Math.max(0, currentWinRate * 0.85), // 15% improvement
          totalTrades: Math.max(1, currentTotalTrades - 5), // 5 more trades
        };
      case "year":
        return {
          pnl: currentPnl * 0.6, // 40% increase from prior year
          winRate: Math.max(0, currentWinRate * 0.8), // 20% improvement
          totalTrades: Math.max(1, currentTotalTrades - 10), // 10 more trades
        };
      default: // month
        return baseValues;
    }
  };

  // Default to month granularity for demo
  const demoPrior = getDemoPriorValues("month");

  return {
    pnl: currentPnl,
    winRate: currentWinRate,
    totalTrades: currentTotalTrades,
    priorPnl: demoPrior.pnl,
    priorWinRate: demoPrior.winRate,
    priorTotalTrades: demoPrior.totalTrades,
    isDemo: true,
  };
}

function buildFeeAdjustedBenchmark(
  timestamps: string[],
  wallets: AlignedWalletSeries[],
  feeInputs?: FeeInputs
): FeeAdjustedBenchmark | null {
  if (!feeInputs) return null;

  const feeRate = feeInputs.feeRate;
  const fixedFee = feeInputs.fixedFee ?? null;
  const hasFeeRate = typeof feeRate === "number" && Number.isFinite(feeRate);

  // Aggregate gross benchmark values across wallets at each timestamp.
  const gross: (number | null)[] = timestamps.map((_, index) => {
    let sum = 0;
    let any = false;
    for (const wallet of wallets) {
      const value = wallet.values[index];
      if (typeof value === "number" && Number.isFinite(value)) {
        sum += value;
        any = true;
      }
    }
    return any ? sum : null;
  });

  const adjusted: (number | null)[] = gross.map((value) => {
    if (value === null) return null;
    if (!hasFeeRate) return null;
    const rate = feeRate as number;
    const fixed = fixedFee ?? 0;
    return value * (1 - rate) - fixed;
  });

  const incomplete = !hasFeeRate || gross.some((value) => value === null);

  const assumptionsParts: string[] = [];
  if (hasFeeRate) {
    assumptionsParts.push(`fee rate ${(feeRate as number) * 100}%`);
  } else {
    assumptionsParts.push("fee rate unavailable");
  }
  assumptionsParts.push(
    fixedFee === null ? "no fixed fee applied" : `fixed fee ${fixedFee} per period`
  );

  let disclosure: string | null = null;
  if (!hasFeeRate) {
    disclosure =
      "Fee rate is unavailable, so fee-adjusted values cannot be computed. Gross values are shown.";
  } else if (incomplete) {
    disclosure =
      "Some periods are missing benchmark history; fee-adjusted values are incomplete for those periods.";
  }

  return {
    gross,
    adjusted,
    assumptions: {
      feeRate: hasFeeRate ? (feeRate as number) : null,
      fixedFee,
      description: assumptionsParts.join(", "),
    },
    incomplete,
    disclosure,
  };
}

/**
 * Hook that compares performance across multiple connected wallets over a shared
 * date range, and optionally derives fee-adjusted benchmark values.
 *
 * - All wallets share the same aligned timestamps and scale.
 * - Missing history is represented as `null` and never plotted as zero.
 * - Exposes loading, empty, and error states.
 * - Fee-adjusted values are only produced when fee inputs are available; incomplete
 *   fee data is disclosed via `benchmark.disclosure`.
 */
export function useMultiWalletComparison({
  walletIds,
  startDate,
  endDate,
  feeInputs,
  fetchHistory,
}: MultiWalletComparisonOptions): MultiWalletComparisonResult {
  const [histories, setHistories] = useState<WalletHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletKey = walletIds.join(",");

  useEffect(() => {
    let cancelled = false;

    if (!walletKey || !startDate || !endDate) {
      setHistories([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!fetchHistory) {
      setHistories([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const ids = walletKey.split(",").filter(Boolean);

    Promise.all(
      ids.map(async (walletId) => {
        try {
          const history = await fetchHistory(walletId, startDate, endDate);
          return history ?? null;
        } catch {
          throw new Error(`Failed to load history for wallet ${walletId}`);
        }
      })
    )
      .then((results) => {
        if (cancelled) return;
        setHistories(results.filter((h): h is WalletHistory => h !== null));
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHistories([]);
        setError(err instanceof Error ? err.message : "Failed to load wallet history");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletKey, startDate, endDate, fetchHistory]);

  return useMemo(() => {
    // Collect the union of timestamps across wallets, sorted ascending.
    const timestampSet = new Set<string>();
    for (const history of histories) {
      for (const point of history.points) {
        if (point.timestamp >= startDate && point.timestamp <= endDate) {
          timestampSet.add(point.timestamp);
        }
      }
    }
    const timestamps = Array.from(timestampSet).sort();

    const wallets: AlignedWalletSeries[] = histories.map((history) => {
      const byTimestamp = new Map<string, number | null>();
      for (const point of history.points) {
        byTimestamp.set(
          point.timestamp,
          typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null
        );
      }
      const values = timestamps.map((ts) => {
        const value = byTimestamp.get(ts);
        return typeof value === "number" ? value : null;
      });
      return {
        walletId: history.walletId,
        label: history.label ?? history.walletId,
        values,
        hasData: values.some((value) => value !== null),
      };
    });

    const isEmpty = !isLoading && !error && wallets.every((wallet) => !wallet.hasData);

    const benchmark = buildFeeAdjustedBenchmark(timestamps, wallets, feeInputs);

    return {
      timestamps,
      wallets,
      benchmark,
      isLoading,
      isEmpty,
      error,
    };
  }, [histories, startDate, endDate, feeInputs, isLoading, error]);
}