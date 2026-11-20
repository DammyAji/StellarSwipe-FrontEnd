import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BacktestParams } from "@/lib/backtest";
import type { FailedBacktestRun } from "@/lib/backtestRetry";

const MAX_FAILED_RUNS = 50;

interface FailedRunsState {
  failures: FailedBacktestRun[];
  /** Records a failed simulation; passing `replaceId` updates that failure instead of adding another. */
  recordFailure: (params: BacktestParams, error: string, replaceId?: string) => string;
  getFailure: (id: string) => FailedBacktestRun | undefined;
  removeFailure: (id: string) => void;
}

export const useBacktestFailedRunsStore = create<FailedRunsState>()(
  persist(
    (set, get) => ({
      failures: [],
      recordFailure: (params, error, replaceId) => {
        const id = replaceId ?? `failed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry: FailedBacktestRun = { id, params, error, timestamp: Date.now() };
        set((state) => ({
          failures: [entry, ...state.failures.filter((f) => f.id !== id)].slice(0, MAX_FAILED_RUNS),
        }));
        return id;
      },
      getFailure: (id) => get().failures.find((f) => f.id === id),
      removeFailure: (id) => set((state) => ({ failures: state.failures.filter((f) => f.id !== id) })),
    }),
    { name: "backtest-failed-runs" }
  )
);
