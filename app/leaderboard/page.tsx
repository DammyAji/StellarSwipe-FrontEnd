"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { SignalProvider } from "@/lib/types";
import { Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { LeaderboardErrorBoundary } from "@/components/LeaderboardErrorBoundary";

type SortField = "rank" | "overallScore" | "winRate" | "recentPerformance";
type SortDirection = "asc" | "desc";

export default function LeaderboardPage() {
  return (
    <LeaderboardErrorBoundary>
      <LeaderboardPageInner />
    </LeaderboardErrorBoundary>
  );
}

function LeaderboardPageInner() {
  const router = useRouter();
  const { data: providers, isLoading, error } = useLeaderboard();
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedProviders = useMemo(() => {
    if (!providers) return [];
    const sorted = [...providers];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [providers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const truncateAddress = (address: string) => {
    return address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-8)}` : address;
  };

  const SortHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors ${
        sortField === field ? "text-foreground" : "text-muted-foreground"
      } ${className}`}
      aria-label={`Sort by ${label}: ${sortField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "not sorted"}`}
    >
      {label}
      {sortField === field && (
        sortDirection === "asc" ? (
          <ChevronUp size={14} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} aria-hidden="true" />
        )
      )}
    </button>
  );

  if (isLoading) {
    return (
      <PageTransition>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
          <p className="text-center text-red-500">Failed to load leaderboard</p>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="flex min-h-screen flex-col gap-6 p-4 sm:gap-8 sm:p-8 bg-gray-950">
        <header className="w-full">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Leaderboard</h1>
          <p className="text-sm text-gray-400 mt-2">Top-performing signal providers</p>
        </header>

        <div className="w-full overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  <SortHeader field="rank" label="Rank" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Provider</th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  <SortHeader field="overallScore" label="Score" className="justify-end" />
                </th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  <SortHeader field="winRate" label="Win Rate" className="justify-end" />
                </th>
                <th className="px-4 py-3 text-right font-semibold text-foreground">
                  <SortHeader field="recentPerformance" label="Recent" className="justify-end" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProviders.map((provider) => (
                <tr
                  key={provider.id}
                  className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/provider/${provider.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/provider/${provider.id}`);
                    }
                  }}
                  aria-label={`View profile for ${provider.name || provider.address}`}
                >
                  <td className="px-4 py-3 font-semibold text-foreground">#{provider.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {provider.name && (
                        <p className="font-medium text-foreground">{provider.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono">
                        {truncateAddress(provider.address)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {provider.overallScore}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {provider.winRate}%
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    provider.recentPerformance >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {provider.recentPerformance >= 0 ? "+" : ""}{provider.recentPerformance}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedProviders.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No providers available</p>
          </div>
        )}
      </main>
    </PageTransition>
  );
}
