import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FilterDirection = "ALL" | "BUY" | "SELL";
export type FeedSortOrder = "latest" | "hot" | "relevant" | "confidence";

/** Human-readable labels for each sort order */
export const SORT_ORDER_LABELS: Record<FeedSortOrder, string> = {
  latest: "Newest",
  hot: "Best Performing",
  relevant: "Relevant",
  confidence: "Confidence",
};

interface SignalFilterState {
  direction: FilterDirection;
  asset: string;
  provider: string;
  bookmarkedOnly: boolean;
  sortOrder: FeedSortOrder;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setDirection: (d: FilterDirection) => void;
  setAsset: (a: string) => void;
  setProvider: (p: string) => void;
  setBookmarkedOnly: (selected: boolean) => void;
  setSortOrder: (o: FeedSortOrder) => void;
  reset: () => void;
}

export const useSignalFilterStore = create<SignalFilterState>()(
  persist(
    (set) => ({
      direction: "ALL",
      asset: "",
      provider: "",
      bookmarkedOnly: false,
      sortOrder: "latest",
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setDirection: (direction) => set({ direction }),
      setAsset: (asset) => set({ asset }),
      setProvider: (provider) => set({ provider }),
      setBookmarkedOnly: (selected) => set({ bookmarkedOnly: selected }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      reset: () =>
        set({
          direction: "ALL",
          asset: "",
          provider: "",
          bookmarkedOnly: false,
          sortOrder: "latest",
        }),
    }),
    {
      name: "signal-filter-store",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Returns `true` once localStorage has been read and state is stable. */
export const useSignalFilterHydrated = () => useSignalFilterStore((s) => s._hasHydrated);
