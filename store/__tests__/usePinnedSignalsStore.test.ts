/**
 * Unit tests for the pinned-signals store (#1097).
 *
 * The store is intentionally orthogonal to bookmark, snooze and dismiss state
 * — these tests confirm toggling a pin never touches the others and never
 * silently loses a pin.
 */

import { usePinnedSignalsStore } from "@/store/usePinnedSignalsStore";
import { useBookmarkStore } from "@/store/useBookmarkStore";
import { useSnoozeStore } from "@/store/useSnoozeStore";

beforeEach(() => {
  // Reset every store so each test starts from a clean slate.
  usePinnedSignalsStore.setState({ pinnedIds: [] });
  useBookmarkStore.setState({ bookmarks: [], folders: [], tags: {} });
  useSnoozeStore.setState({ snoozed: {} });
});

describe("usePinnedSignalsStore", () => {
  it("pins a signal", () => {
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["sig-1"]);
  });

  it("pinning is idempotent", () => {
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["sig-1"]);
  });

  it("preserves insertion order across multiple pins", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().pinSignal("b");
    usePinnedSignalsStore.getState().pinSignal("c");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["a", "b", "c"]);
  });

  it("unpins a signal", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().pinSignal("b");
    usePinnedSignalsStore.getState().unpinSignal("a");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["b"]);
  });

  it("unpinning a non-pinned signal is a no-op", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().unpinSignal("z");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["a"]);
  });

  it("toggles a pin on", () => {
    usePinnedSignalsStore.getState().togglePin("a");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["a"]);
  });

  it("toggles a pin off", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().togglePin("a");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual([]);
  });

  it("reports isPinned correctly", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    expect(usePinnedSignalsStore.getState().isPinned("a")).toBe(true);
    expect(usePinnedSignalsStore.getState().isPinned("b")).toBe(false);
  });

  it("clears all pins", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().pinSignal("b");
    usePinnedSignalsStore.getState().clearPins();
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual([]);
  });

  it("preserves the relative order of remaining pins after an unpin", () => {
    usePinnedSignalsStore.getState().pinSignal("a");
    usePinnedSignalsStore.getState().pinSignal("b");
    usePinnedSignalsStore.getState().pinSignal("c");
    usePinnedSignalsStore.getState().unpinSignal("b");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual(["a", "c"]);
  });
});

describe("usePinnedSignalsStore — orthogonality", () => {
  it("pinning a signal does not bookmark it", () => {
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    expect(useBookmarkStore.getState().bookmarks).not.toContain("sig-1");
  });

  it("pinning a signal does not snooze it", () => {
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    expect(useSnoozeStore.getState().snoozed).not.toHaveProperty("sig-1");
  });

  it("bookmarking a signal does not pin it", () => {
    useBookmarkStore.getState().addBookmark("sig-1");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual([]);
  });

  it("snoozing a signal does not pin it", () => {
    useSnoozeStore.getState().snoozeSignal("sig-1");
    expect(usePinnedSignalsStore.getState().pinnedIds).toEqual([]);
  });

  it("a pinned+bookmarked signal keeps both states independently", () => {
    usePinnedSignalsStore.getState().pinSignal("sig-1");
    useBookmarkStore.getState().addBookmark("sig-1");
    expect(usePinnedSignalsStore.getState().isPinned("sig-1")).toBe(true);
    expect(useBookmarkStore.getState().hasBookmark("sig-1")).toBe(true);

    // Unpinning does not unbookmark.
    usePinnedSignalsStore.getState().unpinSignal("sig-1");
    expect(usePinnedSignalsStore.getState().isPinned("sig-1")).toBe(false);
    expect(useBookmarkStore.getState().hasBookmark("sig-1")).toBe(true);

    // Unbookmarking does not pin.
    useBookmarkStore.getState().removeBookmark("sig-1");
    expect(useBookmarkStore.getState().hasBookmark("sig-1")).toBe(false);
  });
});
