import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A private, per-user note attached to a watchlist asset. */
export interface WatchlistNote {
  /** Asset symbol the note is tied to, e.g. "XLM". */
  symbol: string;
  /** Note body. Never empty — removing the text removes the note. */
  text: string;
  /** ISO timestamp when the note was first created. */
  createdAt: string;
  /** ISO timestamp when the note was last edited. */
  updatedAt: string;
}

interface WatchlistState {
  watchlist: string[]; // array of asset symbols
  /** Private notes keyed by asset symbol. */
  notes: Record<string, WatchlistNote>;
  hasWatchlist: (symbol: string) => boolean;
  addWatchlist: (symbol: string) => void;
  removeWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  setWatchlist: (symbols: string[]) => void;
  clearWatchlist: () => void;
  /** Create or replace the note for an asset. Empty text removes the note. */
  setNote: (symbol: string, text: string) => void;
  /** Remove the note for an asset. */
  removeNote: (symbol: string) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      watchlist: [],
      notes: {},
      hasWatchlist: (symbol: string) => get().watchlist.includes(symbol),
      addWatchlist: (symbol: string) =>
        set((state) => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol],
        })),
      removeWatchlist: (symbol: string) =>
        set((state) => {
          const { [symbol]: _removed, ...notes } = state.notes;
          return {
            watchlist: state.watchlist.filter((watchlist) => watchlist !== symbol),
            notes,
          };
        }),
      toggleWatchlist: (symbol: string) =>
        set((state) => {
          if (state.watchlist.includes(symbol)) {
            const { [symbol]: _removed, ...notes } = state.notes;
            return {
              watchlist: state.watchlist.filter((watchlist) => watchlist !== symbol),
              notes,
            };
          }
          return { watchlist: [...state.watchlist, symbol] };
        }),
      setWatchlist: (symbols: string[]) =>
        set((state) => {
          const next = [...new Set(symbols)];
          const notes = Object.fromEntries(
            Object.entries(state.notes).filter(([symbol]) => next.includes(symbol))
          );
          return { watchlist: next, notes };
        }),
      clearWatchlist: () => set({ watchlist: [], notes: {} }),
      setNote: (symbol: string, text: string) =>
        set((state) => {
          const trimmed = text.trim();
          if (!trimmed) {
            const { [symbol]: _removed, ...notes } = state.notes;
            return { notes };
          }
          const now = new Date().toISOString();
          const existing = state.notes[symbol];
          return {
            notes: {
              ...state.notes,
              [symbol]: {
                symbol,
                text: trimmed,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              },
            },
          };
        }),
      removeNote: (symbol: string) =>
        set((state) => {
          const { [symbol]: _removed, ...notes } = state.notes;
          return { notes };
        }),
    }),
    {
      name: "watchlist-store",
      // Persisted state from before notes existed has no `notes` key.
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<WatchlistState>;
        return { ...current, ...state, notes: state.notes ?? {} };
      },
    }
  )
);
/** Returns the private note for an asset, or `null` when none exists. */
export function useWatchlistNote(symbol: string): WatchlistNote | null {
  return useWatchlistStore((state) => state.notes[symbol] ?? null);
}