"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useBacktestHistoryStore } from "@/store/useBacktestHistoryStore"
import { Button } from "@/components/ui/button"
import { BacktestFailedRuns } from "@/components/BacktestFailedRuns"

const METRICS = [
  {
    key: "totalReturn",
    label: "Return",
    format: (v: number) => `${(v * 100).toFixed(2)}%`,
    color: (v: number) => (v >= 0 ? "text-green-400" : "text-red-400"),
  },
  {
    key: "winRate",
    label: "Win Rate",
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    color: () => "",
  },
  {
    key: "maxDrawdown",
    label: "Drawdown",
    format: (v: number) => `${(v * 100).toFixed(2)}%`,
    color: () => "text-red-400",
  },
] as const

type LedgerTrade = {
  id?: string
  entry?: number | null
  exit?: number | null
  outcome?: string | null
  timestamp?: string | number | null
}

const LEDGER_PAGE_SIZE = 50

function tradeTime(trade: LedgerTrade): number {
  if (trade.timestamp == null) return Number.NaN
  const t = typeof trade.timestamp === "number" ? trade.timestamp : Date.parse(trade.timestamp)
  return Number.isNaN(t) ? Number.NaN : t
}

function formatTradeTime(trade: LedgerTrade): string {
  const t = tradeTime(trade)
  return Number.isNaN(t) ? "—" : new Date(t).toLocaleString()
}

function formatPrice(value: number | null | undefined): string {
  return typeof value === "number" && !Number.isNaN(value) ? value.toFixed(2) : "—"
}

function TradeLedger({ trades }: { trades: LedgerTrade[] }) {
  const [sortAsc, setSortAsc] = useState(true)
  const [visibleCount, setVisibleCount] = useState(LEDGER_PAGE_SIZE)

  const sortedTrades = useMemo(() => {
    const copy = [...trades]
    copy.sort((a, b) => {
      const ta = tradeTime(a)
      const tb = tradeTime(b)
      const na = Number.isNaN(ta)
      const nb = Number.isNaN(tb)
      if (na && nb) return 0
      if (na) return 1
      if (nb) return -1
      return sortAsc ? ta - tb : tb - ta
    })
    return copy
  }, [trades, sortAsc])

  const visibleTrades = sortedTrades.slice(0, visibleCount)

  if (trades.length === 0) {
    return (
      <p className="text-sm text-gray-400" data-testid="trade-ledger-empty">
        No simulated trades were recorded for this run.
      </p>
    )
  }

  return (
    <div data-testid="trade-ledger">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">
          {trades.length} trade{trades.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortAsc((prev) => !prev)}
          data-testid="trade-ledger-sort"
        >
          Sort by time: {sortAsc ? "Oldest first" : "Newest first"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm border border-border rounded-lg">
          <caption className="sr-only">Per-trade ledger for this backtest run</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left p-3 text-xs text-gray-400 font-medium">Entry</th>
              <th scope="col" className="text-left p-3 text-xs text-gray-400 font-medium">Exit</th>
              <th scope="col" className="text-left p-3 text-xs text-gray-400 font-medium">Outcome</th>
              <th scope="col" className="text-left p-3 text-xs text-gray-400 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {visibleTrades.map((trade, index) => (
              <tr
                key={trade.id ?? index}
                className="border-b border-border last:border-b-0"
                data-testid={`trade-ledger-row-${index}`}
              >
                <td className="p-3">{formatPrice(trade.entry)}</td>
                <td className="p-3">{formatPrice(trade.exit)}</td>
                <td className="p-3">{trade.outcome ?? "—"}</td>
                <td className="p-3 text-gray-400">{formatTradeTime(trade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleCount < sortedTrades.length && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((prev) => prev + LEDGER_PAGE_SIZE)}
            data-testid="trade-ledger-show-more"
          >
            Show more ({sortedTrades.length - visibleCount} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}

export default function BacktestHistoryPage() {
  const { runs, clearHistory } = useBacktestHistoryStore()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openLedgerIds, setOpenLedgerIds] = useState<string[]>([])

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const removeSelected = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  const toggleLedger = (id: string) => {
    setOpenLedgerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectedRuns = runs.filter((run) => selectedIds.includes(run.id))

  return (
    <div className="p-6">
      <BacktestFailedRuns />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Backtest Run History</h1>
        <div className="flex gap-2">
          {runs.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearHistory}>
              Clear History
            </Button>
          )}
          <Link href="/backtest-sim">
            <Button size="sm">New Run</Button>
          </Link>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="text-gray-400">No backtest runs yet. Run a simulation to see history here.</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const assumptions = run.assumptions
            const isSelected = selectedIds.includes(run.id)
            const ledgerOpen = openLedgerIds.includes(run.id)
            const trades: LedgerTrade[] = Array.isArray(run.result?.trades)
              ? (run.result.trades as LedgerTrade[])
              : []
            return (
              <div
                key={run.id}
                className="bg-surface border border-border rounded-lg p-4 hover:bg-white/5 transition-colors"
                data-testid={`history-run-${run.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={isSelected}
                      onChange={() => toggleSelected(run.id)}
                      aria-label={`Select run ${run.params.from} to ${run.params.to} for comparison`}
                      data-testid={`history-run-select-${run.id}`}
                    />
                    <Link
                      href={`/backtest-sim/history/${run.id}`}
                      className="block min-w-0"
                    >
                      <p className="text-sm font-medium">
                        {run.params.from} → {run.params.to}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Signals: {run.params.signals.length > 0 ? run.params.signals.join(", ") : "none"} ·{" "}
                        {new Date(run.timestamp).toLocaleString()}
                      </p>
                      <p
                        className="text-xs text-gray-400 mt-1"
                        data-testid={`history-run-assumptions-${run.id}`}
                      >
                        {assumptions ? (
                          <>
                            <span className="text-gray-500">Backtest assumptions (read-only):</span>{" "}
                            Fee {(assumptions.feeRate * 100).toFixed(3)}% · Slippage{" "}
                            {(assumptions.slippageRate * 100).toFixed(3)}%
                          </>
                        ) : (
                          <span className="text-gray-500">Backtest assumptions: unavailable</span>
                        )}
                      </p>
                    </Link>
                  </div>
                  <div className="flex gap-4 text-sm text-right shrink-0">
                    <div>
                      <p className="text-xs text-gray-400">Return</p>
                      <p className={run.result.totalReturn >= 0 ? "text-green-400" : "text-red-400"}>
                        {(run.result.totalReturn * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Win Rate</p>
                      <p>{(run.result.winRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Drawdown</p>
                      <p className="text-red-400">{(run.result.maxDrawdown * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleLedger(run.id)}
                    aria-expanded={ledgerOpen}
                    data-testid={`history-run-ledger-toggle-${run.id}`}
                  >
                    {ledgerOpen ? "Hide trade ledger" : "View trade ledger"}
                  </Button>
                </div>
                {ledgerOpen && (
                  <div className="mt-3 border-t border-border pt-3">
                    <TradeLedger trades={trades} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedRuns.length > 0 && (
        <section
          className="mt-8"
          aria-label="Backtest run comparison"
          data-testid="history-comparison"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Compare Runs</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              data-testid="history-comparison-clear"
            >
              Clear Comparison
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm border border-border rounded-lg">
              <caption className="sr-only">
                Side-by-side comparison of selected backtest runs
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="text-left p-3 text-xs text-gray-400 font-medium">
                    Metric
                  </th>
                  {selectedRuns.map((run) => (
                    <th
                      key={run.id}
                      scope="col"
                      className="text-right p-3 text-xs text-gray-400 font-medium"
                    >
                      <span className="block">
                        {run.params.from} → {run.params.to}
                      </span>
                      <button
                        type="button"
                        className="mt-1 text-xs text-gray-500 hover:text-gray-300 underline"
                        onClick={() => removeSelected(run.id)}
                        aria-label={`Remove run ${run.params.from} to ${run.params.to} from comparison`}
                        data-testid={`history-comparison-remove-${run.id}`}
                      >
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => (
                  <tr key={metric.key} className="border-b border-border last:border-b-0">
                    <th scope="row" className="text-left p-3 font-normal text-gray-400">
                      {metric.label}
                    </th>
                    {selectedRuns.map((run) => {
                      const value = run.result?.[metric.key]
                      const missing = typeof value !== "number" || Number.isNaN(value)
                      return (
                        <td
                          key={run.id}
                          className="text-right p-3"
                          data-testid={`history-comparison-${run.id}-${metric.key}`}
                        >
                          {missing ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <span className={metric.color(value as number)}>
                              {metric.format(value as number)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
