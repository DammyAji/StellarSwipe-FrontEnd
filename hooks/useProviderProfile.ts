import { useQuery } from "@tanstack/react-query";
import { SignalProvider, ProviderSignal } from "@/lib/types";
import { queryOptions } from "@/lib/queryOptions";

const mockProviderDetails: Record<string, SignalProvider> = {
  "provider-1": {
    id: "provider-1",
    address: "GA7VIQKEA7HQNGYAUTALPC3D4GBTUFJGD2U7YKWXY7HXHPAWGP7XVFUA",
    name: "AlphaTrader",
    overallScore: 94,
    winRate: 87,
    totalSignals: 256,
    recentPerformance: 12.5,
    rank: 1,
    bio: "Professional trader with 10+ years of experience in cryptocurrency markets.",
    reputation: 95,
    staked: 50000,
    trustScore: 92,
  },
};

const mockProviderSignals: Record<string, ProviderSignal[]> = {
  "provider-1": [
    {
      id: "sig-1",
      asset: "XLM",
      direction: "BUY",
      confidence: 87,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: "WIN",
      targetPrice: 0.5310,
      actualPrice: 0.5420,
    },
    {
      id: "sig-2",
      asset: "AQUA",
      direction: "SELL",
      confidence: 72,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      outcome: "WIN",
      targetPrice: 0.35,
      actualPrice: 0.34,
    },
    {
      id: "sig-3",
      asset: "XLM",
      direction: "BUY",
      confidence: 65,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      outcome: "LOSS",
      targetPrice: 0.52,
      actualPrice: 0.48,
    },
    {
      id: "sig-4",
      asset: "USDC",
      direction: "BUY",
      confidence: 81,
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      outcome: "PENDING",
      targetPrice: 1.02,
    },
  ],
};

export function useProviderProfile(providerId: string) {
  return useQuery({
    queryKey: ["provider", providerId],
    queryFn: async () => {
      return mockProviderDetails[providerId] || null;
    },
    ...queryOptions.provider,
  });
}

export function useProviderSignals(providerId: string) {
  return useQuery({
    queryKey: ["provider-signals", providerId],
    queryFn: async () => {
      return mockProviderSignals[providerId] || [];
    },
    ...queryOptions.providerSignals,
  });
}
