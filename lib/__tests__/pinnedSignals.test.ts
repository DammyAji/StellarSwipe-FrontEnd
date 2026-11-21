/**
 * Unit tests for pinned-signal feed ordering helpers (#1097).
 *
 * The helpers are pure, so feed-ordering is unit-testable without rendering.
 */

import {
  applyPins,
  pinPosition,
  hasVisiblePins,
  feedRowKey,
} from "@/lib/pinnedSignals";

const feed = [
  { id: "b", ticker: "BTC" },
  { id: "a", ticker: "XLM" },
  { id: "c", ticker: "ETH" },
  { id: "d", ticker: "USDC" },
];

// ── applyPins ───────────────────────────────────────────────────────────────

describe("applyPins", () => {
  it("returns the same order when nothing is pinned", () => {
    expect(applyPins(feed, [])).toEqual(feed);
  });

  it("returns a new array, not a reference", () => {
    const out = applyPins(feed, []);
    expect(out).not.toBe(feed);
    expect(out).toEqual(feed);
  });

  it("hoists a single pinned signal to the top", () => {
    const out = applyPins(feed, ["c"]);
    expect(out.map((s) => s.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("hoists multiple pinned signals in pin order (oldest pin first)", () => {
    // pin order: d, then a → d should appear above a even though a is "newer"
    const out = applyPins(feed, ["d", "a"]);
    expect(out.map((s) => s.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("preserves the existing order of non-pinned signals", () => {
    const out = applyPins(feed, ["a"]);
    expect(out.slice(1).map((s) => s.id)).toEqual(["b", "c", "d"]);
  });

  it("ignores pinned ids that are not present in the feed (no phantom rows)", () => {
    const out = applyPins(feed, ["z", "a", "missing"]);
    expect(out.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(out).toHaveLength(feed.length);
  });

  it("preserves pin order across multiple pins including ones not in the feed", () => {
    // pin order: x (missing), c, a → c above a
    const out = applyPins(feed, ["x", "c", "a"]);
    expect(out.map((s) => s.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...feed];
    applyPins(feed, ["a", "c"]);
    expect(feed).toEqual(copy);
  });

  it("handles an empty feed", () => {
    expect(applyPins([], ["a"])).toEqual([]);
    expect(applyPins([], [])).toEqual([]);
  });

  it("does not duplicate a pinned signal that appears once", () => {
    const out = applyPins(feed, ["a"]);
    expect(out.filter((s) => s.id === "a")).toHaveLength(1);
  });

  it("keeps the first occurrence when the feed has duplicate ids", () => {
    const dup = [
      { id: "a", ticker: "XLM" },
      { id: "a", ticker: "XLM-duplicate" },
    ];
    const out = applyPins(dup, ["a"]);
    // Only the first occurrence is hoisted; the duplicate stays where it is.
    expect(out).toHaveLength(2);
    expect(out[0].ticker).toBe("XLM");
  });
});

// ── pinPosition ──────────────────────────────────────────────────────────────

describe("pinPosition", () => {
  it("returns the 0-based index of a pinned id", () => {
    expect(pinPosition("a", ["a", "c"])).toBe(0);
    expect(pinPosition("c", ["a", "c"])).toBe(1);
  });

  it("returns -1 when the id is not pinned", () => {
    expect(pinPosition("z", ["a", "c"])).toBe(-1);
    expect(pinPosition("a", [])).toBe(-1);
  });
});

// ── hasVisiblePins ────────────────────────────────────────────────────────────

describe("hasVisiblePins", () => {
  it("returns false when nothing is pinned", () => {
    expect(hasVisiblePins(feed, [])).toBe(false);
  });

  it("returns true when at least one pinned id is in the feed", () => {
    expect(hasVisiblePins(feed, ["a"])).toBe(true);
    expect(hasVisiblePins(feed, ["a", "z"])).toBe(true);
  });

  it("returns false when all pinned ids are missing from the feed", () => {
    expect(hasVisiblePins(feed, ["z", "missing"])).toBe(false);
  });

  it("returns false for an empty feed", () => {
    expect(hasVisiblePins([], ["a"])).toBe(false);
  });
});

// ── feedRowKey ────────────────────────────────────────────────────────────────

describe("feedRowKey", () => {
  it("prefixes pinned ids so React can distinguish them from non-pinned rows", () => {
    expect(feedRowKey("a", ["a", "c"])).toBe("pin-a");
    expect(feedRowKey("c", ["a", "c"])).toBe("pin-c");
  });

  it("uses the bare id for non-pinned rows", () => {
    expect(feedRowKey("b", ["a", "c"])).toBe("b");
    expect(feedRowKey("b", [])).toBe("b");
  });
});
