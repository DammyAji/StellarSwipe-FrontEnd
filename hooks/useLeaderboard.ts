import { useQuery } from "@tanstack/react-query";
import { SignalProvider } from "@/lib/types";
import { queryOptions } from "@/lib/queryOptions";

const mockProviders: SignalProvider[] = [
  {
    id: "provider-1",
    address: "GA7VIQKEA7HQNGYAUTALPC3D4GBTUFJGD2U7YKWXY7HXHPAWGP7XVFUA",
    name: "AlphaTrader",
    overallScore: 94,
    winRate: 87,
    totalSignals: 256,
    recentPerformance: 12.5,
    rank: 1,
  },
  {
    id: "provider-2",
    address: "GAJQHJDHFVJDHBFJNHFDJHF7HXHPAWGP7XVFUA1234567890AB",
    name: "SignalMaster",
    overallScore: 89,
    winRate: 82,
    totalSignals: 198,
    recentPerformance: 8.3,
    rank: 2,
  },
  {
    id: "provider-3",
    address: "GBVDJKBVJKBVJBVJKBVJKBVJKBVJKBVJKBVJKBV",
    name: "TrendFollower",
    overallScore: 85,
    winRate: 78,
    totalSignals: 312,
    recentPerformance: 5.2,
    rank: 3,
  },
  {
    id: "provider-4",
    address: "GCVDJKBVJKBVJBVJKBVJKBVJKBVJKBVJKBVJKBV",
    name: "ProSignals",
    overallScore: 81,
    winRate: 75,
    totalSignals: 145,
    recentPerformance: -2.1,
    rank: 4,
  },
  {
    id: "provider-5",
    address: "GDVDJKBVJKBVJBVJKBVJKBVJKBVJKBVJKBVJKBV",
    overallScore: 78,
    winRate: 72,
    totalSignals: 189,
    recentPerformance: 3.8,
    rank: 5,
  },
];

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // In real app, fetch from API
      return mockProviders;
    },
    ...queryOptions.leaderboard,
  });
}
