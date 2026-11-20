import { countTags, orderTagsForPicker, togglePinnedTag } from "@/lib/journalPinnedTags";

describe("countTags", () => {
  it("counts tags across entries, most used first", () => {
    expect(
      countTags([{ tags: ["dca", "breakout"] }, { tags: ["dca"] }, {}, { tags: ["alpha"] }])
    ).toEqual([
      { tag: "dca", count: 2 },
      { tag: "alpha", count: 1 },
      { tag: "breakout", count: 1 },
    ]);
  });
});

describe("orderTagsForPicker", () => {
  const known = [
    { tag: "dca", count: 5 },
    { tag: "breakout", count: 3 },
    { tag: "scalp", count: 1 },
  ];

  it("puts pinned tags first in pin order, then the rest by usage", () => {
    const groups = orderTagsForPicker(known, ["scalp", "dca"], []);
    expect(groups.pinned.map((t) => t.tag)).toEqual(["scalp", "dca"]);
    expect(groups.others.map((t) => t.tag)).toEqual(["breakout"]);
  });

  it("keeps a pinned tag that no entry uses any more, with a zero count", () => {
    const groups = orderTagsForPicker(known, ["deleted-tag"], []);
    expect(groups.pinned).toEqual([{ tag: "deleted-tag", count: 0, pinned: true, selected: false }]);
    expect(groups.others).toHaveLength(3);
  });

  it("marks selected tags and normalizes pinned input", () => {
    const groups = orderTagsForPicker(known, ["  DCA "], ["dca"]);
    expect(groups.pinned[0]).toMatchObject({ tag: "dca", pinned: true, selected: true });
  });

  it("returns empty groups when there are no tags", () => {
    expect(orderTagsForPicker([], [], [])).toEqual({ pinned: [], others: [] });
  });
});

describe("togglePinnedTag", () => {
  it("pins and unpins without mutating the input", () => {
    const start = ["dca"];
    const pinned = togglePinnedTag(start, " Breakout ");
    expect(pinned).toEqual(["dca", "breakout"]);
    expect(start).toEqual(["dca"]);
    expect(togglePinnedTag(pinned, "dca")).toEqual(["breakout"]);
  });

  it("ignores blank tags", () => {
    expect(togglePinnedTag(["dca"], "   ")).toEqual(["dca"]);
  });
});
