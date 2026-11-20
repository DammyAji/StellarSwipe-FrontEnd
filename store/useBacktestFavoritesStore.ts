import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pruneFavorites, toggleFavorite } from "@/lib/backtestFavorites";

export const BACKTEST_FAVORITES_STORAGE_KEY = "backtest-favorites";

interface BacktestFavoritesState {
  /** Ids of favorited runs. Kept apart from the run history so result data is never touched. */
  favoriteIds: string[];
  toggle: (runId: string) => void;
  prune: (existingRunIds: readonly string[]) => void;
}

export const useBacktestFavoritesStore = create<BacktestFavoritesState>()(
  persist(
    (set) => ({
      favoriteIds: [],
      toggle: (runId) => set((state) => ({ favoriteIds: toggleFavorite(state.favoriteIds, runId) })),
      prune: (existingRunIds) =>
        set((state) => {
          const kept = pruneFavorites(state.favoriteIds, existingRunIds);
          return kept === state.favoriteIds ? state : { favoriteIds: kept };
        }),
    }),
    { name: BACKTEST_FAVORITES_STORAGE_KEY }
  )
);
