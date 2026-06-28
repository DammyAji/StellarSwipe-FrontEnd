import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BookmarkState {
  bookmarks: string[];
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  hasBookmark: (id: string) => boolean;
  addBookmark: (id: string) => void;
  removeBookmark: (id: string) => void;
  toggleBookmark: (id: string) => void;
  setBookmarks: (ids: string[]) => void;
  clearBookmarks: () => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      hasBookmark: (id: string) => get().bookmarks.includes(id),
      addBookmark: (id: string) =>
        set((state) => ({
          bookmarks: state.bookmarks.includes(id)
            ? state.bookmarks
            : [...state.bookmarks, id],
        })),
      removeBookmark: (id: string) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((bookmark) => bookmark !== id),
        })),
      toggleBookmark: (id: string) =>
        set((state) => ({
          bookmarks: state.bookmarks.includes(id)
            ? state.bookmarks.filter((bookmark) => bookmark !== id)
            : [...state.bookmarks, id],
        })),
      setBookmarks: (ids: string[]) => set({ bookmarks: [...new Set(ids)] }),
      clearBookmarks: () => set({ bookmarks: [] }),
    }),
    {
      name: "signal-bookmarks",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Returns `true` once localStorage has been read and state is stable. */
export const useBookmarkHydrated = () => useBookmarkStore((s) => s._hasHydrated);
