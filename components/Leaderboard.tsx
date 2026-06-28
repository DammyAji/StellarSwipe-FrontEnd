import React from "react";
import Image from "next/image";
import { useLeaderboardStore, type LeaderboardEntry } from "../store/leaderboardStore";
import { formatNumber } from "../lib/utils";

export const Leaderboard: React.FC = () => {
  const { rankings, loading, error, fetchRankings } = useLeaderboardStore();

  React.useEffect(() => {
    fetchRankings();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">Failed to load leaderboard: {error}</div>;
  }

  return (
    <section className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-indigo-500 to-purple-600 text-transparent bg-clip-text">
        Community Leaderboard
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rankings.map((entry: LeaderboardEntry) => (
          <article
            key={entry.id}
            className="p-4 bg-white bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <Image
                src={entry.avatarUrl}
                alt={entry.username}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                sizes="64px"
              />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-800">
                  {entry.anonymous ? "Anonymous" : entry.username}
                </h2>
                <p className="text-sm text-gray-600">{entry.marketType}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Return %</p>
                <p className="text-lg font-medium text-green-600">
                  {formatNumber(entry.returnPct)}%
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
