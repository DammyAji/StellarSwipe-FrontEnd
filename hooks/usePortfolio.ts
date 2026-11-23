"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioStore, type PortfolioAsset } from "@/store/usePortfolioStore";
import { useWalletStore } from "@/store/useWalletStore";
import { queryOptions } from "@/lib/queryOptions";

export interface PortfolioHistoryPoint {
  /** ISO date (YYYY-MM-DD) the point belongs to. */
  date: string;
  /** Total portfolio value on that day. */
  value: number;
}

export interface WalletHistorySeries {
  publicKey: string;
  /** Human friendly label for legends. */
  label: string;
  /** Only days with known history are present; missing days are omitted. */
  points: PortfolioHistoryPoint[];
}

export interface DailyReturnPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Percentage return for the day, or null when it cannot be computed. */
  returnPct: number | null;
}

export interface PortfolioHistoryResult {
  /** History keyed by connected wallet public key. */
  byWallet: Record<string, WalletHistorySeries>;
  /** Daily returns derived from the combined portfolio history. */
  dailyReturns: DailyReturnPoint[];
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function toIsoDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function shortAddress(publicKey: string): string {
  return publicKey.length > 8
    ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`
    : publicKey;
}

/**
 * Normalizes raw history into a sorted, de-duplicated series. Days without a
 * value are dropped entirely so consumers never plot missing history as zero.
 */
function normalizeHistory(
  raw: Array<{ date: string | Date; value: number | null | undefined }> | undefined
): PortfolioHistoryPoint[] {
  if (!raw || raw.length === 0) return [];
  const byDate = new Map<string, number>();
  for (const point of raw) {
    const date = toIsoDate(point.date);
    if (!date) continue;
    if (point.value === null || point.value === undefined) continue;
    if (!Number.isFinite(point.value)) continue;
    byDate.set(date, point.value);
  }
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Derives daily percentage returns from a combined value series. Days where
 * either the current or previous value is unknown produce a null return rather
 * than a fabricated zero.
 */
function deriveDailyReturns(
  series: PortfolioHistoryPoint[]
): DailyReturnPoint[] {
  if (series.length === 0) return [];
  const byDate = new Map(series.map((p) => [p.date, p.value]));
  const dates = series.map((p) => p.date).sort();
  const first = new Date(`${dates[0]}T00:00:00Z`);
  const last = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return [];

  const result: DailyReturnPoint[] = [];
  let previous: number | null = null;
  for (
    let cursor = new Date(first);
    cursor.getTime() <= last.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    const value = byDate.get(date);
    if (value === undefined) {
      // Missing day: emit a null return and reset the baseline so the next
      // available day is not compared against stale data.
      result.push({ date, returnPct: null });
      previous = null;
      continue;
    }
    if (previous === null || previous === 0) {
      result.push({ date, returnPct: null });
    } else {
      result.push({ date, returnPct: ((value - previous) / previous) * 100 });
    }
    previous = value;
  }
  return result;
}
function withPercentages(
  assets: Omit<PortfolioAsset, "percentage">[],
  walletAddress?: string
): PortfolioAsset[] {
  const total = assets.reduce((sum, a) => sum + a.value, 0);
  return assets.map((a) => ({
    ...a,
    // Only attribute holdings to a wallet when the wallet is actually known.
    walletAddress: a.walletAddress ?? walletAddress,
    percentage: total > 0 ? Math.round((a.value / total) * 1000) / 10 : 0,
  }));
}

export function usePortfolio() {
  const { publicKey, connected } = useWallet();
  const store = usePortfolioStore();
  const connectedWallets = useWalletStore((s) => s.wallets);

  // Reset a wallet filter that no longer refers to a connected wallet so the
  // view never claims to be filtered by an unavailable account.
  useEffect(() => {
    const filter = store.walletFilter;
    if (filter && !connectedWallets.some((w) => w.publicKey === filter)) {
      store.setWalletFilter(null);
    }
  }, [connectedWallets, store]);

  // Initialize with demo data if store is empty
  useEffect(() => {
    if (store.assets.length === 0 && !connected) {
      const demoPortfolio = withPercentages([
        {
          symbol: "XLM",
          name: "Stellar",
          value: 1500,
          color: "#0d1f2d",
          realizedPnL: 120,
          unrealizedPnL: 85,
        },
        {
          symbol: "USDC",
          name: "USD Coin",
          value: 800,
          color: "#2775ca",
          realizedPnL: 45,
          unrealizedPnL: 12,
        },
        {
          symbol: "AQUA",
          name: "Aqua",
          value: 350,
          color: "#00c5ff",
          realizedPnL: -20,
          unrealizedPnL: 28,
        },
        {
          symbol: "yXLM",
          name: "Yield XLM",
          value: 200,
          color: "#7b61ff",
          realizedPnL: 60,
          unrealizedPnL: 35,
        },
      ]);
      store.setAssets(demoPortfolio);
    }
  }, [store, connected]);

  const fetchPortfolio = async () => {
    // In real app, fetch from API based on publicKey
    const realPortfolio = withPercentages([
      {
        symbol: "XLM",
        name: "Stellar",
        value: 1500,
        color: "#0d1f2d",
        realizedPnL: 120,
        unrealizedPnL: 85,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        value: 800,
        color: "#2775ca",
        realizedPnL: 45,
        unrealizedPnL: 12,
      },
      {
        symbol: "AQUA",
        name: "Aqua",
        value: 350,
        color: "#00c5ff",
        realizedPnL: -20,
        unrealizedPnL: 28,
      },
      {
        symbol: "yXLM",
        name: "Yield XLM",
        value: 200,
        color: "#7b61ff",
        realizedPnL: 60,
        unrealizedPnL: 35,
      },
    ]);
    return realPortfolio;
  };

  const { data, refetch } = useQuery({
    queryKey: ["portfolio", publicKey],
    queryFn: fetchPortfolio,
    enabled: connected && !!publicKey,
    ...queryOptions.portfolio,
  });

  const historyQuery = useQuery({
    queryKey: ["portfolio-history", connectedWallets.map((w) => w.publicKey)],
    queryFn: async () => {
      // In a real app this would fetch per-wallet history from the API.
      const entries = await Promise.all(
        connectedWallets.map(async (wallet) => {
          const raw = await fetchWalletHistory(wallet.publicKey);
          return [wallet.publicKey, normalizeHistory(raw)] as const;
        })
      );
      return Object.fromEntries(entries) as Record<
        string,
        PortfolioHistoryPoint[]
      >;
    },
    enabled: connectedWallets.length > 0,
    ...queryOptions.portfolio,
  });

  const historyByWallet = useMemo<Record<string, WalletHistorySeries>>(() => {
    const raw = historyQuery.data ?? {};
    const result: Record<string, WalletHistorySeries> = {};
    for (const wallet of connectedWallets) {
      const points = raw[wallet.publicKey] ?? [];
      result[wallet.publicKey] = {
        publicKey: wallet.publicKey,
        label: wallet.label ?? shortAddress(wallet.publicKey),
        points,
      };
    }
    return result;
  }, [historyQuery.data, connectedWallets]);

  const dailyReturns = useMemo<DailyReturnPoint[]>(() => {
    // Combine all wallet series into a single portfolio value series so the
    // heatmap reflects total performance. Missing days stay absent.
    const combined = new Map<string, number>();
    for (const series of Object.values(historyByWallet)) {
      for (const point of series.points) {
        combined.set(point.date, (combined.get(point.date) ?? 0) + point.value);
      }
    }
    const merged = Array.from(combined.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return deriveDailyReturns(merged);
  }, [historyByWallet]);

  const historyIsEmpty =
    !historyQuery.isLoading &&
    !historyQuery.isError &&
    Object.values(historyByWallet).every((s) => s.points.length === 0);

  useEffect(() => {
    if (data) {
      store.setAssets(data);
    }
  }, [data, store]);

  // Initialize quote prices for all assets if not already set
  useEffect(() => {
    const assets = store.assets;
    const now = new Date();
    let needsInit = false;
    if (assets.length > 0) {
      const firstAsset = assets[0];
      if (firstAsset.quotePrice === undefined || firstAsset.quoteLastUpdated === undefined) {
        needsInit = true;
      }
    }
    if (needsInit) {
      const initializedAssets = assets.map((asset) => ({
        ...asset,
        quotePrice: asset.value,
        quoteLastUpdated: now,
      }));
      store.setAssets(initializedAssets);
    }
  }, [store.assets]);

  const history: PortfolioHistoryResult = {
    byWallet: historyByWallet,
    dailyReturns,
    isLoading: historyQuery.isLoading,
    isEmpty: historyIsEmpty,
    isError: historyQuery.isError,
    error: (historyQuery.error as Error | null) ?? null,
    refetch: () => {
      void historyQuery.refetch();
    },
  };

  return {
    assets: data || store.assets,
    totalRealizedPnL: store.totalRealizedPnL,
    totalUnrealizedPnL: store.totalUnrealizedPnL,
    totalValue: store.totalValue,
    isLoading: store.isLoading,
    refetch,
    walletFilter: store.walletFilter,
    setWalletFilter: store.setWalletFilter,
    connectedWallets: connectedWallets.map((w) => w.publicKey),
    history,
  };
}

/**
 * Placeholder history fetcher. Returns an empty array when no history is
 * available so callers can distinguish "no data" from zero values.
 */
async function fetchWalletHistory(
  _publicKey: string
): Promise<Array<{ date: string; value: number | null }>> {
  return [];
}
