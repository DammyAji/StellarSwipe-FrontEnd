/**
 * @jest-environment jsdom
 *
 * Tests for useSearchFilter hook.
 *
 * Verifies:
 * - debouncing behaviour (searchValue updates immediately; filteredCount uses the debounced value)
 * - direction / asset / provider / bookmarkedOnly filters
 * - clearSearch resets provider in the filter store
 * - hasActiveFilters reflects any active filter combination
 * - filteredSignals returns empty array while store is not yet hydrated
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useSearchFilter } from "../useSearchFilter";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetProvider = jest.fn();
const mockBookmarks: string[] = [];

let mockStoreState = {
  direction: "ALL" as "ALL" | "BUY" | "SELL",
  asset: "",
  provider: "",
  bookmarkedOnly: false,
  sortOrder: "latest" as const,
  _hasHydrated: true,
};

jest.mock("@/store/useSignalFilterStore", () => ({
  useSignalFilterStore: (selector: (s: typeof mockStoreState & { setProvider: typeof mockSetProvider }) => unknown) =>
    selector({ ...mockStoreState, setProvider: mockSetProvider }),
  useSignalFilterHydrated: () => mockStoreState._hasHydrated,
}));

jest.mock("@/store/useBookmarkStore", () => ({
  useBookmarkStore: (selector: (s: { bookmarks: string[] }) => unknown) =>
    selector({ bookmarks: mockBookmarks }),
}));

const mockSnoozed: Record<string, unknown> = {};
jest.mock("@/store/useSnoozeStore", () => ({
  useSnoozeStore: (selector: (s: { snoozed: Record<string, unknown> }) => unknown) =>
    selector({ snoozed: mockSnoozed }),
  // Pass-through: no signals are snoozed in these tests
  selectVisibleSignals: (signals: unknown[]) => signals,
}));

const mockPinnedIds: string[] = [];
jest.mock("@/store/usePinnedSignalsStore", () => ({
  usePinnedSignalsStore: (selector: (s: { pinnedIds: string[] }) => unknown) =>
    selector({ pinnedIds: mockPinnedIds }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSignal = (
  id: string,
  ticker: string,
  action: "BUY" | "SELL" | "HOLD",
  details = "test details",
  confidence = 80
) => ({
  id,
  ticker,
  action,
  details,
  confidence,
  timestamp: new Date().toISOString(),
  provider: "TestProvider",
  status: "Active" as const,
  expiresAt: null,
});

const ALL_SIGNALS = [
  makeSignal("1", "XLM", "BUY", "Stellar buy signal"),
  makeSignal("2", "BTC", "SELL", "Bitcoin sell signal"),
  makeSignal("3", "ETH", "HOLD", "Ethereum hold signal"),
  makeSignal("4", "XLM", "SELL", "Stellar sell signal"),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset mock store state back to neutral defaults */
function resetStore() {
  mockStoreState = {
    direction: "ALL",
    asset: "",
    provider: "",
    bookmarkedOnly: false,
    sortOrder: "latest",
    _hasHydrated: true,
  };
  mockSetProvider.mockClear();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSearchFilter", () => {
  beforeEach(resetStore);

  // ── Basic rendering ──────────────────────────────────────────────────────

  it("returns all signals when no filters are active", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredSignals).toHaveLength(ALL_SIGNALS.length);
    expect(result.current.filteredCount).toBe(ALL_SIGNALS.length);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("returns empty array while store is not yet hydrated", () => {
    mockStoreState._hasHydrated = false;

    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredSignals).toHaveLength(0);
    expect(result.current.filteredCount).toBe(0);
  });

  // ── Direction filter ─────────────────────────────────────────────────────

  it("filters by BUY direction", () => {
    mockStoreState.direction = "BUY";

    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredSignals.every((s) => s.action === "BUY")).toBe(true);
    expect(result.current.filteredCount).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("filters by SELL direction", () => {
    mockStoreState.direction = "SELL";

    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredSignals.every((s) => s.action === "SELL")).toBe(true);
    expect(result.current.filteredCount).toBe(2);
  });

  // ── Asset filter ─────────────────────────────────────────────────────────

  it("filters by asset (ticker contains substring)", () => {
    mockStoreState.asset = "XLM";

    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredSignals.every((s) => s.ticker.includes("XLM"))).toBe(true);
    expect(result.current.filteredCount).toBe(2);
  });

  // ── Bookmarked only ──────────────────────────────────────────────────────

  it("filters to bookmarked signals only", () => {
    mockStoreState.bookmarkedOnly = true;
    mockBookmarks.push("1", "3");

    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    expect(result.current.filteredCount).toBe(2);
    expect(result.current.filteredSignals.map((s) => s.id)).toEqual(
      expect.arrayContaining(["1", "3"])
    );
    expect(result.current.hasActiveFilters).toBe(true);

    // Clean up shared array mutation
    mockBookmarks.splice(0, mockBookmarks.length);
  });

  // ── searchValue / debouncing ─────────────────────────────────────────────

  it("searchValue updates synchronously via setSearchValue", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS, debounceMs: 100 })
    );

    act(() => {
      result.current.setSearchValue("stellar");
    });

    expect(result.current.searchValue).toBe("stellar");
    // The filter store setter should also have been called
    expect(mockSetProvider).toHaveBeenCalledWith("stellar");
  });

  it("applies the debounced search term to filtering after the delay", async () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS, debounceMs: 50 })
    );

    act(() => {
      result.current.setSearchValue("bitcoin");
    });

    // Before debounce resolves, filteredSignals may still be unfiltered
    // (provider in store is still ""; debounced value hasn't fired yet).
    // After the delay, "bitcoin" should match the BTC SELL signal's details.
    await waitFor(
      () =>
        expect(result.current.filteredCount).toBeLessThan(ALL_SIGNALS.length),
      { timeout: 300 }
    );
  });

  // ── clearSearch ──────────────────────────────────────────────────────────

  it("clearSearch resets searchValue and calls setProvider with empty string", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    act(() => {
      result.current.setSearchValue("xlm");
    });

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchValue).toBe("");
    expect(mockSetProvider).toHaveBeenLastCalledWith("");
  });

  // ── hasActiveFilters ─────────────────────────────────────────────────────

  it("hasActiveFilters is false when all filters are at defaults", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("hasActiveFilters is true when searchValue is non-empty", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );

    act(() => {
      result.current.setSearchValue("btc");
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  // ── Sort order ───────────────────────────────────────────────────────────

  it("sorts by confidence when sortOrder is 'confidence'", () => {
    mockStoreState.sortOrder = "confidence";
    const signals = [
      makeSignal("a", "A", "BUY", "low", 40),
      makeSignal("b", "B", "BUY", "high", 90),
      makeSignal("c", "C", "SELL", "mid", 70),
    ];

    const { result } = renderHook(() => useSearchFilter({ signals }));

    const confidences = result.current.filteredSignals.map((s) => s.confidence);
    expect(confidences).toEqual([90, 70, 40]);
  });

  it("sorts latest first when sortOrder is 'latest'", () => {
    mockStoreState.sortOrder = "latest";
    const now = Date.now();
    const signals = [
      { ...makeSignal("old", "X", "BUY"), timestamp: new Date(now - 60000).toISOString() },
      { ...makeSignal("new", "Y", "SELL"), timestamp: new Date(now).toISOString() },
    ];

    const { result } = renderHook(() => useSearchFilter({ signals }));

    expect(result.current.filteredSignals[0]!.id).toBe("new");
    expect(result.current.filteredSignals[1]!.id).toBe("old");
  });
});
