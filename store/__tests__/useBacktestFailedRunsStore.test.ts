import { useBacktestFailedRunsStore } from "@/store/useBacktestFailedRunsStore";
import type { BacktestParams } from "@/lib/backtest";

const params: BacktestParams = { from: "2023-01-01", to: "2023-12-31", signals: ["providerA"], feeBps: 10, slippageBps: 10 };

beforeEach(() => useBacktestFailedRunsStore.setState({ failures: [] }));

describe("useBacktestFailedRunsStore", () => {
  it("records a failure with its inputs and error", () => {
    const id = useBacktestFailedRunsStore.getState().recordFailure(params, "Network down");
    const failure = useBacktestFailedRunsStore.getState().getFailure(id);
    expect(failure).toMatchObject({ id, params, error: "Network down" });
  });

  it("updates the same failure when a retry fails again instead of adding another", () => {
    const store = useBacktestFailedRunsStore.getState();
    const id = store.recordFailure(params, "first");
    store.recordFailure(params, "second", id);
    const { failures } = useBacktestFailedRunsStore.getState();
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe("second");
  });

  it("removes a failure after a successful retry", () => {
    const id = useBacktestFailedRunsStore.getState().recordFailure(params, "x");
    useBacktestFailedRunsStore.getState().removeFailure(id);
    expect(useBacktestFailedRunsStore.getState().failures).toEqual([]);
  });

  it("keeps only the most recent failures", () => {
    for (let i = 0; i < 60; i++) useBacktestFailedRunsStore.getState().recordFailure(params, `e${i}`);
    const { failures } = useBacktestFailedRunsStore.getState();
    expect(failures).toHaveLength(50);
    expect(failures[0].error).toBe("e59");
  });
});
