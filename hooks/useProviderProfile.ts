import { useQuery } from "@tanstack/react-query";
import { SignalProvider, ProviderSignal } from "@/lib/types";
import { queryOptions } from "@/lib/queryOptions";

export type ProviderSignalScope = "active" | "archived" | "all";

type ProviderSignalEntry = ProviderSignal & {
  archived?: boolean;
  evidence?: { label: string; url: string }[];
};

type ProviderProfileDetails = SignalProvider & {
  coveredAssets?: string[];
};

const mockProviderDetails: Record<string, ProviderProfileDetails> = {
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

const mockProviderSignals: Record<string, ProviderSignalEntry[]> = {
  "provider-1": [
    {
      id: "sig-1",
      asset: "XLM",
      direction: "BUY",
      confidence: 87,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: "WIN",
      targetPrice: 0.531,
      actualPrice: 0.542,
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
    {
      id: "sig-5",
      asset: "XLM",
      direction: "SELL",
      confidence: 78,
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      outcome: "WIN",
      targetPrice: 0.49,
      actualPrice: 0.47,
      archived: true,
    },
    {
      id: "sig-6",
      asset: "AQUA",
      direction: "BUY",
      confidence: 69,
      timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      outcome: "LOSS",
      targetPrice: 0.31,
      actualPrice: 0.29,
      archived: true,
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

export function useProviderSignals(
  providerId: string,
  scope: ProviderSignalScope = "active"
) {
  return useQuery({
    queryKey: ["provider-signals", providerId, scope],
    queryFn: async () => {
      const rawSignals = mockProviderSignals[providerId] || [];
      return rawSignals
        .filter((signal) => {
          const isArchived = signal.archived === true;
          if (scope === "active") return !isArchived;
          if (scope === "archived") return isArchived;
          return true;
        })
        .map((signal) => ({
          ...signal,
          lastUpdated: signal.timestamp,
          hasRevision: false,
        }));
    },
    ...queryOptions.providerSignals,
  });
}

export function useProviderCoveredAssets(providerId: string) {
  return useQuery({
    queryKey: ["provider-covered-assets", providerId],
    queryFn: async () => {
      const rawSignals = mockProviderSignals[providerId] || [];
      const assets = rawSignals
        .map((signal) => signal.asset)
        .filter((asset): asset is string => Boolean(asset));
      return Array.from(new Set(assets)).sort((a, b) => a.localeCompare(b));
    },
    ...queryOptions.providerSignals,
  });
}
