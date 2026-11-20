import { favoriteAnnouncement, filterRunsByFavorite, pruneFavorites, toggleFavorite } from "@/lib/backtestFavorites";

describe("toggleFavorite", () => {
  it("adds and removes without mutating the input", () => {
    const start = ["a"];
    const added = toggleFavorite(start, "b");
    expect(added).toEqual(["a", "b"]);
    expect(start).toEqual(["a"]);
    expect(toggleFavorite(added, "a")).toEqual(["b"]);
  });
});

describe("pruneFavorites", () => {
  it("drops favorites of runs that no longer exist and keeps the same array otherwise", () => {
    expect(pruneFavorites(["a", "b", "c"], ["a", "c"])).toEqual(["a", "c"]);
    const same = ["a", "b"];
    expect(pruneFavorites(same, ["a", "b", "z"])).toBe(same);
  });
});

describe("filterRunsByFavorite", () => {
  const runs = [{ id: "r1", n: 1 }, { id: "r2", n: 2 }, { id: "r3", n: 3 }];
  it("returns every run unless favorites only is on", () => {
    expect(filterRunsByFavorite(runs, ["r2"], false)).toEqual(runs);
  });
  it("returns only favorite runs, unchanged, in their original order", () => {
    const result = filterRunsByFavorite(runs, ["r3", "r1"], true);
    expect(result).toEqual([runs[0], runs[2]]);
    expect(result[0]).toBe(runs[0]);
  });
  it("returns an empty list when there are no favorites", () => {
    expect(filterRunsByFavorite(runs, [], true)).toEqual([]);
  });
});

describe("favoriteAnnouncement", () => {
  it("states the change and whether it was saved", () => {
    expect(favoriteAnnouncement(true, true)).toBe("Added to favorites. Saved on this device.");
    expect(favoriteAnnouncement(false, true)).toBe("Removed from favorites. Saved on this device.");
    expect(favoriteAnnouncement(true, false)).toMatch(/could not be saved/);
  });
});
