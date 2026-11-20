import { useBacktestFavoritesStore } from "@/store/useBacktestFavoritesStore";
import { useBacktestHistoryStore } from "@/store/useBacktestHistoryStore";

beforeEach(() => {
  useBacktestFavoritesStore.setState({ favoriteIds: [] });
  useBacktestHistoryStore.setState({ runs: [] });
});

describe("useBacktestFavoritesStore", () => {
  it("toggles a run in and out of favorites", () => {
    useBacktestFavoritesStore.getState().toggle("run-1");
    expect(useBacktestFavoritesStore.getState().favoriteIds).toEqual(["run-1"]);
    useBacktestFavoritesStore.getState().toggle("run-1");
    expect(useBacktestFavoritesStore.getState().favoriteIds).toEqual([]);
  });

  it("prunes favorites of removed runs", () => {
    useBacktestFavoritesStore.setState({ favoriteIds: ["a", "b"] });
    useBacktestFavoritesStore.getState().prune(["b"]);
    expect(useBacktestFavoritesStore.getState().favoriteIds).toEqual(["b"]);
  });

  it("never changes the run history or its result data", () => {
    const params = { from: "2023-01-01", to: "2023-02-01", signals: [], feeBps: 1, slippageBps: 1 };
    const result = { totalReturn: 0.1, winRate: 0.5, maxDrawdown: 0.1, trades: [] };
    const id = useBacktestHistoryStore.getState().addRun(params, result);
    const before = JSON.stringify(useBacktestHistoryStore.getState().runs);
    useBacktestFavoritesStore.getState().toggle(id);
    expect(JSON.stringify(useBacktestHistoryStore.getState().runs)).toBe(before);
  });
});
