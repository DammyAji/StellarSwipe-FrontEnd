"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioStore, type PortfolioAsset } from "@/store/usePortfolioStore";
import { queryOptions } from "@/lib/queryOptions";

function withPercentages(
  assets: Omit<PortfolioAsset, "percentage">[]
): PortfolioAsset[] {
  const total = assets.reduce((sum, a) => sum + a.value, 0);
  return assets.map((a) => ({
    ...a,
    percentage: total > 0 ? Math.round((a.value / total) * 1000) / 10 : 0,
  }));
}

export function usePortfolio() {
  const { publicKey, connected } = useWallet();
  const store = usePortfolioStore();

  // Initialize with demo data if store is empty
  useEffect(() => {
    if (store.assets.length === 0 && !connected) {
      const demoPortfolio = withPercentages([
        { symbol: "XLM", name: "Stellar", value: 1500, color: "#0d1f2d", realizedPnL: 120, unrealizedPnL: 85 },
        { symbol: "USDC", name: "USD Coin", value: 800, color: "#2775ca", realizedPnL: 45, unrealizedPnL: 12 },
        { symbol: "AQUA", name: "Aqua", value: 350, color: "#00c5ff", realizedPnL: -20, unrealizedPnL: 28 },
        { symbol: "yXLM", name: "Yield XLM", value: 200, color: "#7b61ff", realizedPnL: 60, unrealizedPnL: 35 },
      ]);
      store.setAssets(demoPortfolio);
    }
  }, [store, connected]);

  const fetchPortfolio = async () => {
    // In real app, fetch from API based on publicKey
    const realPortfolio = withPercentages([
      { symbol: "XLM", name: "Stellar", value: 1500, color: "#0d1f2d", realizedPnL: 120, unrealizedPnL: 85 },
      { symbol: "USDC", name: "USD Coin", value: 800, color: "#2775ca", realizedPnL: 45, unrealizedPnL: 12 },
      { symbol: "AQUA", name: "Aqua", value: 350, color: "#00c5ff", realizedPnL: -20, unrealizedPnL: 28 },
      { symbol: "yXLM", name: "Yield XLM", value: 200, color: "#7b61ff", realizedPnL: 60, unrealizedPnL: 35 },
    ]);
    return realPortfolio;
  };

  const { data, refetch } = useQuery({
    queryKey: ["portfolio", publicKey],
    queryFn: fetchPortfolio,
    enabled: connected && !!publicKey,
    ...queryOptions.portfolio,
  });

  useEffect(() => {
    if (data) {
      store.setAssets(data);
    }
  }, [data, store]);

  return {
    assets: data || store.assets,
    totalRealizedPnL: store.totalRealizedPnL,
    totalUnrealizedPnL: store.totalUnrealizedPnL,
    totalValue: store.totalValue,
    isLoading: store.isLoading,
    refetch,
  };
}