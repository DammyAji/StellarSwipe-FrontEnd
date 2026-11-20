"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { favoriteAnnouncement } from "@/lib/backtestFavorites";
import { BACKTEST_FAVORITES_STORAGE_KEY, useBacktestFavoritesStore } from "@/store/useBacktestFavoritesStore";

interface BacktestFavoriteButtonProps {
  runId: string;
  /** Short run description used in the accessible name, e.g. "2023-01-01 to 2023-12-31". */
  runLabel: string;
}

/** Whether the persisted favorites actually contain (or lack) the run after a change. */
function isPersisted(runId: string, expectFavorite: boolean): boolean {
  try {
    const raw = localStorage.getItem(BACKTEST_FAVORITES_STORAGE_KEY);
    const ids: string[] = raw ? (JSON.parse(raw)?.state?.favoriteIds ?? []) : [];
    return ids.includes(runId) === expectFavorite;
  } catch {
    return false;
  }
}

/** Star toggle for a history row; announces the change and whether it was saved. */
export function BacktestFavoriteButton({ runId, runLabel }: BacktestFavoriteButtonProps) {
  const isFavorite = useBacktestFavoritesStore((state) => state.favoriteIds.includes(runId));
  const toggle = useBacktestFavoritesStore((state) => state.toggle);
  const [message, setMessage] = useState("");

  function handleClick() {
    const next = !isFavorite;
    toggle(runId);
    setMessage(favoriteAnnouncement(next, isPersisted(runId, next)));
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove run ${runLabel} from favorites` : `Add run ${runLabel} to favorites`}
        className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`history-run-favorite-${runId}`}
      >
        <Star size={16} aria-hidden="true" className={isFavorite ? "fill-amber-300 text-amber-300" : ""} />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
    </>
  );
}
