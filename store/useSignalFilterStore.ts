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

export interface FilterPreset {
  name: string;
  direction: FilterDirection;
  asset: string;
  provider: string;
  bookmarkedOnly: boolean;
  sortOrder: FeedSortOrder;
}

interface SignalFilterState {
  direction: FilterDirection;
  asset: string;
  provider: string;
  bookmarkedOnly: boolean;
  followedOnly: boolean;
  /** Minimum provider track-record length in days; null = no threshold */
  minTrackRecordDays: number | null;
  sortOrder: FeedSortOrder;
  presets: FilterPreset[];
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setDirection: (d: FilterDirection) => void;
  setAsset: (a: string) => void;
  setProvider: (p: string) => void;
  setBookmarkedOnly: (selected: boolean) => void;
  setFollowedOnly: (selected: boolean) => void;
  setMinTrackRecordDays: (days: number | null) => void;
  setSortOrder: (o: FeedSortOrder) => void;
  savePreset: (name: string) => void;
  applyPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  reset: () => void;
}

export const useSignalFilterStore = create<SignalFilterState>()(
  persist(
    (set, get) => ({
      direction: "ALL",
      asset: "",
      provider: "",
      bookmarkedOnly: false,
      followedOnly: false,
      sortOrder: "latest",
      presets: [],
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      setDirection: (direction) => set({ direction }),
      setAsset: (asset) => set({ asset }),
      setProvider: (provider) => set({ provider }),
      setBookmarkedOnly: (selected) => set({ bookmarkedOnly: selected }),
      setFollowedOnly: (selected) => set({ followedOnly: selected }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      savePreset: (name) => {
        const {
          direction,
          asset,
          provider,
          bookmarkedOnly,
          sortOrder,
          presets,
        } = get();
        const preset: FilterPreset = {
          name,
          direction,
          asset,
          provider,
          bookmarkedOnly,
          sortOrder,
        };
        const existing = presets.findIndex((p) => p.name === name);
        if (existing >= 0) {
          const updated = [...presets];
          updated[existing] = preset;
          set({ presets: updated });
        } else {
          set({ presets: [...presets, preset] });
        }
      },
      applyPreset: (name) => {
        const preset = get().presets.find((p) => p.name === name);
        if (!preset) return;
        set({
          direction: preset.direction,
          asset: preset.asset,
          provider: preset.provider,
          bookmarkedOnly: preset.bookmarkedOnly,
          sortOrder: preset.sortOrder,
        });
      },
      deletePreset: (name) => {
        set({ presets: get().presets.filter((p) => p.name !== name) });
      },
      reset: () =>
        set({
          direction: "ALL",
          asset: "",
          provider: "",
          bookmarkedOnly: false,
          followedOnly: false,
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
export const useSignalFilterHydrated = () =>
  useSignalFilterStore((s) => s._hasHydrated);
