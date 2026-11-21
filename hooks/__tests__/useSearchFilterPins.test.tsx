/**
 * @jest-environment jsdom
 *
 * Integration tests for pin hoisting through useSearchFilter (#1097).
 *
 * Confirms pinned signals are hoisted to the top of the filtered+sorted feed
 * without breaking pagination, filtering or the global sort order. Each
 * store is mocked so the hook's pure feed-ordering behaviour is testable in
 * isolation from the real persisted stores.
 */

import { renderHook, act } from "@testing-library/react";
import { useSearchFilter } from "@/hooks/useSearchFilter";

// ---------------------------------------------------------------------------
// Mutable mock state — reset before each test so isolation is guaranteed.
// ---------------------------------------------------------------------------

let mockDirection = "ALL";
let mockAsset = "";
let mockProvider = "";
let mockSortOrder = "latest";
let mockBookmarkedOnly = false;
let mockFollowedOnly = false;
let mockHydrated = true;
let mockBookmarks: string[] = [];
let mockPinnedIds: string[] = [];
const mockSnoozed: Record<string, number> = {};
const mockFollowedProviders: string[] = [];

jest.mock("@/store/useSignalFilterStore", () => ({
  useSignalFilterStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      direction: mockDirection,
      asset: mockAsset,
      provider: mockProvider,
      sortOrder: mockSortOrder,
      bookmarkedOnly: mockBookmarkedOnly,
      followedOnly: mockFollowedOnly,
      setProvider: (v: string) => {
        mockProvider = v;
      },
    };
    return typeof selector === "function" ? selector(state) : state;
  },
  useSignalFilterHydrated: () => mockHydrated,
}));

jest.mock("@/store/useBookmarkStore", () => ({
  useBookmarkStore: (selector: (s: { bookmarks: string[] }) => unknown) =>
    selector({ bookmarks: mockBookmarks }),
}));

jest.mock("@/store/useSnoozeStore", () => ({
  useSnoozeStore: (selector: (s: { snoozed: Record<string, number> }) => unknown) =>
    selector({ snoozed: mockSnoozed }),
  selectVisibleSignals: (signals: unknown[]) => signals,
}));

jest.mock("@/store/usePinnedSignalsStore", () => ({
  usePinnedSignalsStore: (selector: (s: { pinnedIds: string[] }) => unknown) =>
    selector({ pinnedIds: mockPinnedIds }),
}));

jest.mock("@/store/useFollowedProvidersStore", () => ({
  useFollowedProvidersStore: (selector: (s: { followedProviders: string[] }) => unknown) =>
    selector({ followedProviders: mockFollowedProviders }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSignal(
  id: string,
  ticker: string,
  action: "BUY" | "SELL" | "HOLD",
  timestampMs: number,
  confidence = 80
) {
  return {
    id,
    ticker,
    action,
    details: "test",
    confidence,
    timestamp: new Date(timestampMs).toISOString(),
    provider: "TestProvider",
    status: "Active" as const,
    expiresAt: null as string | null,
  };
}

// Newest first: sig-4, sig-3, sig-2, sig-1
const ALL_SIGNALS = [
  makeSignal("1", "XLM", "BUY", 1000),
  makeSignal("2", "BTC", "SELL", 2000),
  makeSignal("3", "ETH", "HOLD", 3000),
  makeSignal("4", "XLM", "SELL", 4000),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockDirection = "ALL";
  mockAsset = "";
  mockProvider = "";
  mockSortOrder = "latest";
  mockBookmarkedOnly = false;
  mockFollowedOnly = false;
  mockHydrated = true;
  mockBookmarks = [];
  mockPinnedIds = [];
  // Clear snoozed entries without reassigning the object reference (it's
  // captured by the mock closure).
  for (const k of Object.keys(mockSnoozed)) delete mockSnoozed[k];
}

function ids(result: { filteredSignals: { id: string }[] }): string[] {
  return result.filteredSignals.map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSearchFilter — pinned signals (#1097)", () => {
  beforeEach(resetMocks);

  it("returns the feed in sort order when nothing is pinned", () => {
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    // sortOrder 'latest' → newest first: 4, 3, 2, 1
    expect(ids(result.current)).toEqual(["4", "3", "2", "1"]);
  });

  it("hoists a single pinned signal to the top", () => {
    mockPinnedIds = ["1"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    expect(ids(result.current)).toEqual(["1", "4", "3", "2"]);
  });

  it("hoists multiple pinned signals in pin order, not sort order", () => {
    // Pin order: 2, then 4. Even though 4 is newer, 2 should appear above it
    // because it was pinned first.
    mockPinnedIds = ["2", "4"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    expect(ids(result.current)).toEqual(["2", "4", "3", "1"]);
  });

  it("preserves the sort order for non-pinned signals", () => {
    mockPinnedIds = ["1"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    // Non-pinned block: 4, 3, 2 (latest first)
    expect(ids(result.current).slice(1)).toEqual(["4", "3", "2"]);
  });

  it("does not break pagination — all signals remain present", () => {
    mockPinnedIds = ["3", "1"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    expect(result.current.filteredSignals).toHaveLength(ALL_SIGNALS.length);
  });

  it("ignores pinned ids that are not in the feed (no phantom rows)", () => {
    mockPinnedIds = ["missing", "2"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    expect(ids(result.current)).toEqual(["2", "4", "3", "1"]);
    expect(result.current.filteredSignals).toHaveLength(ALL_SIGNALS.length);
  });

  it("hoists pinned signals even when filtering by direction", () => {
    mockDirection = "SELL";
    mockPinnedIds = ["4"]; // sig-4 is a SELL signal
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    // Only SELL signals: 4, 2 — 4 is pinned so it stays on top
    expect(ids(result.current)).toEqual(["4", "2"]);
  });

  it("hoists pinned signals even when filtering by asset", () => {
    mockAsset = "XLM";
    mockPinnedIds = ["1"]; // sig-1 is XLM
    const { result } = renderHook(() =>
      useSearchFilter({ signals: ALL_SIGNALS })
    );
    // XLM signals: 4, 1 — 1 is pinned so it goes on top
    expect(ids(result.current)).toEqual(["1", "4"]);
  });

  it("hoists pinned signals even when sorting by confidence", () => {
    mockSortOrder = "confidence";
    // Give sig-1 the highest confidence so it would sort first anyway,
    // and sig-2 the lowest. Pin sig-2 to confirm the pin overrides sort.
    const signals = [
      makeSignal("1", "XLM", "BUY", 1000, 95),
      makeSignal("2", "BTC", "SELL", 2000, 30),
      makeSignal("3", "ETH", "HOLD", 3000, 70),
    ];
    mockPinnedIds = ["2"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals })
    );
    // Without pins: 1 (95), 3 (70), 2 (30). With pin: 2 first, then 1, 3.
    expect(ids(result.current)).toEqual(["2", "1", "3"]);
  });

  it("returns an empty feed unchanged when pins are set", () => {
    mockPinnedIds = ["1", "2"];
    const { result } = renderHook(() =>
      useSearchFilter({ signals: [] })
    );
    expect(result.current.filteredSignals).toEqual([]);
    expect(result.current.filteredCount).toBe(0);
  });

  it("respects pinned signals after a re-render with updated pins", () => {
    const { result, rerender } = renderHook(
      ({ pinned }: { pinned: string[] }) => {
        mockPinnedIds = pinned;
        return useSearchFilter({ signals: ALL_SIGNALS });
      },
      { initialProps: { pinned: [] } }
    );

    // Initially: sort order only
    expect(ids(result.current)).toEqual(["4", "3", "2", "1"]);

    // Pin sig-2 and re-render
    rerender({ pinned: ["2"] });
    expect(ids(result.current)).toEqual(["2", "4", "3", "1"]);
  });
});
