"use client";

import Link from "next/link";
import { ArrowLeft, BookmarkX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalCard } from "@/components/SignalCard";
import { useBookmarkStore, useBookmarkHydrated } from "@/store/useBookmarkStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import type { Signal } from "@/lib/signals";

interface BookmarksPageProps {
  initialSignals: Signal[];
}

function BookmarksEmptyState() {
  return (
    <div
      role="status"
      aria-label="No bookmarked signals yet"
      className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-white/10 bg-slate-950/80 px-6 py-16 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5" aria-hidden="true">
        <BookmarkX className="h-8 w-8 text-sky-400/80" />
      </div>

      <div className="max-w-sm">
        <p className="text-lg font-semibold text-white">No bookmarks yet</p>
        <p className="mt-1.5 text-sm text-foreground-muted">
          Save signals from the main feed to build a short list here. You can unbookmark
          them at any time and bring them back with undo.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="sm" className="gap-2">
          <Link href="/app">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Browse feed
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-2">
          <Link href="/providers">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Explore providers
          </Link>
        </Button>
      </div>
    </div>
  );
}

function BookmarksSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading bookmarks">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-32 rounded-2xl border border-white/10 bg-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

export function BookmarksPage({ initialSignals }: BookmarksPageProps) {
  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const isHydrated = useBookmarkHydrated();
  const { assets } = usePortfolio();

  const bookmarkedSignals = initialSignals.filter((signal) => bookmarks.includes(signal.id));
  const portfolioBalance = assets.reduce((sum, asset) => sum + asset.value, 0);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400/90">Bookmarks</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Saved signals
            </h1>
            <p className="max-w-2xl text-sm text-foreground-muted">
              Signals you save from the main feed appear here automatically and stay in sync
              across the app.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-foreground-muted">
              {isHydrated ? `${bookmarkedSignals.length} saved` : "—"}
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/app">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to feed
              </Link>
            </Button>
          </div>
        </div>

        {!isHydrated ? (
          <BookmarksSkeleton />
        ) : bookmarkedSignals.length === 0 ? (
          <BookmarksEmptyState />
        ) : (
          <div className="space-y-4">
            {bookmarkedSignals.map((signal) => (
              <SignalCard
                key={signal.id}
                signalId={signal.id}
                pair={`${signal.ticker}/USDC`}
                action={signal.action}
                confidence={signal.confidence}
                analysis={signal.details}
                providerName={signal.provider}
                timestamp={new Date(signal.timestamp)}
                showPassAction={false}
                portfolioBalance={portfolioBalance}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
