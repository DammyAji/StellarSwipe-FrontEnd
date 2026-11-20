"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useBacktestHistoryStore } from "@/store/useBacktestHistoryStore"
import { Button } from "@/components/ui/button"
import { BacktestNoTradesExplainer } from "@/components/BacktestNoTradesExplainer"
import { BacktestConfigSnapshot } from "@/components/BacktestConfigSnapshot"
import { BacktestBaselineCard } from "@/components/BacktestBaselineCard"
import { BacktestDrawdownInspector } from "@/components/BacktestDrawdownInspector"

type TradeSortOrder = "asc" | "desc"

const PAGE_SIZE = 50

export default function BacktestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const run = useBacktestHistoryStore((s) => s.getRun(runId))
  const [sortOrder, setSortOrder] = useState<TradeSortOrder>("asc")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const trades = run?.result.trades ?? []

  const sortedTrades = useMemo(() => {
    const indexed = trades.map((trade, index) => ({ trade, index }))
    indexed.sort((a, b) => {
      const aTime = a.trade.time
      const bTime = b.trade.time
      if (aTime === bTime) return a.index - b.index
      return sortOrder === "asc" ? (aTime < bTime ? -1 : 1) : aTime < bTime ? 1 : -1
    })
    return indexed.map((entry) => entry.trade)
  }, [trades, sortOrder])

  if (!run) {
    return (
      <div className="p-6">
        <p className="text-gray-400 mb-4">Run not found.</p>
        <Link href="/backtest-sim/history">
          <Button variant="outline" size="sm">← Back to History</Button>
        </Link>
      </div>
    )
  }

  const assumptions = run.assumptions
  const visibleTrades = sortedTrades.slice(0, visibleCount)

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/backtest-sim/history">
          <Button variant="outline" size="sm">← History</Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {run.params.from} → {run.params.to}
        </h1>
      </div>

      <p className="text-xs text-gray-400 mb-6">{new Date(run.timestamp).toLocaleString()}</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Total Return</p>
          <p className="text-lg font-semibold">{(run.result.totalReturn * 100).toFixed(2)}%</p>
        </div>
        <div className="bg-white/5 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Win Rate</p>
          <p className="text-lg font-semibold">{(run.result.winRate * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white/5 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
          <p className="text-lg font-semibold">{(run.result.maxDrawdown * 100).toFixed(2)}%</p>
        </div>
      </div>

      <BacktestConfigSnapshot run={run} />
      <div className="mb-6">
        <BacktestBaselineCard params={run.params} result={run.result} />
      </div>
      <div className="mb-6">
        <BacktestDrawdownInspector result={run.result} />
      </div>

      <div className="mb-6 rounded border border-white/10 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
          Backtest Assumptions (read-only)
        </p>
        {assumptions ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Fee</p>
              <p className="font-semibold">{assumptions.feeBps} bps</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Slippage</p>
              <p className="font-semibold">{assumptions.slippageBps} bps</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Assumptions unavailable for this run.</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          These are the execution costs applied to this backtest run and are not live trading settings.
        </p>
      </div>

      <div className="mb-4 text-sm text-gray-400 space-y-1">
        <p>Signals: {run.params.signals.length > 0 ? run.params.signals.join(", ") : "none"}</p>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trade Ledger</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort by time</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              setVisibleCount(PAGE_SIZE)
            }}
          >
            {sortOrder === "asc" ? "Oldest first" : "Newest first"}
          </Button>
        </div>
      </div>

      {sortedTrades.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">No simulated trades for this run.</p>
          <BacktestNoTradesExplainer params={run.params} result={run.result} inputsHref="/backtest-sim" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Entry</th>
                  <th className="pb-2 pr-4">Exit</th>
                  <th className="pb-2 pr-4">Outcome</th>
                  <th className="pb-2">PnL</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((t, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1 pr-4">{t.time}</td>
                    <td className="py-1 pr-4">{t.entry ?? "—"}</td>
                    <td className="py-1 pr-4">{t.exit ?? "—"}</td>
                    <td className="py-1 pr-4">
                      {t.outcome ?? (t.pnl >= 0 ? "win" : "loss")}
                    </td>
                    <td className={`py-1 ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCount < sortedTrades.length && (
            <div className="mt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Show more ({sortedTrades.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
