"use client";

import React, { useEffect, useState } from "react";
import {
  runBacktest,
  type BacktestParams,
  type BacktestResult,
} from "@/lib/backtest";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BacktestBaselineCard } from "@/components/BacktestBaselineCard";
import { BacktestDrawdownInspector } from "@/components/BacktestDrawdownInspector";
import {
  DEFAULT_BACKTEST_PARAMS,
  diffAgainstDefaults,
  retryEligibility,
  type ParamDifference,
} from "@/lib/backtestRetry";
import { useBacktestFailedRunsStore } from "@/store/useBacktestFailedRunsStore";
import { Check, Download, History, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBacktestPresetsStore } from "@/store/useBacktestPresetsStore";
import { useBacktestHistoryStore } from "@/store/useBacktestHistoryStore";
import { toast } from "@/lib/toast";
import { BacktestNoTradesExplainer } from "@/components/BacktestNoTradesExplainer";

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(params: BacktestParams, result: BacktestResult) {
  const header = "time,pnl\n";
  const rows = result.trades.map((t) => `${t.time},${t.pnl}`).join("\n");
  const meta = [
    `# from,${params.from}`,
    `# to,${params.to}`,
    `# signals,${params.signals.join("|")}`,
    `# slippageBps,${params.slippageBps ?? 0}`,
    `# feeBps,${params.feeBps ?? 0}`,
    `# totalReturn,${result.totalReturn}`,
    `# winRate,${result.winRate}`,
    `# maxDrawdown,${result.maxDrawdown}`,
  ].join("\n");
  downloadFile(`${meta}\n${header}${rows}`, "backtest-result.csv", "text/csv");
}

function exportJSON(params: BacktestParams, result: BacktestResult) {
  const payload = { inputs: params, results: result };
  downloadFile(
    JSON.stringify(payload, null, 2),
    "backtest-result.json",
    "application/json"
  );
}

export default function BacktestTool() {
  const [from, setFrom] = useState<string>(DEFAULT_BACKTEST_PARAMS.from);
  const [to, setTo] = useState<string>(DEFAULT_BACKTEST_PARAMS.to);
  const [selected, setSelected] = useState<string[]>(DEFAULT_BACKTEST_PARAMS.signals);
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_BACKTEST_PARAMS.slippageBps);
  const [feeBps, setFeeBps] = useState<number>(DEFAULT_BACKTEST_PARAMS.feeBps);
  const [result, setResult] = useState<BacktestResult | null>(null);
  // Inputs the displayed result was produced with (the form may change afterwards).
  const [resultParams, setResultParams] = useState<BacktestParams | null>(null);

  // Retry of a failed run (#1129): `?retry=<id>` restores that run's saved inputs.
  const retryId = useSearchParams().get("retry");
  const getFailure = useBacktestFailedRunsStore((s) => s.getFailure);
  const recordFailure = useBacktestFailedRunsStore((s) => s.recordFailure);
  const removeFailure = useBacktestFailedRunsStore((s) => s.removeFailure);
  const [retryInfo, setRetryInfo] = useState<{ id: string; differences: ParamDifference[]; error: string } | null>(null);
  const [retryProblem, setRetryProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRename, setConfirmRename] = useState(false);
  const [presetStatus, setPresetStatus] = useState("");

  const { presets, savePreset, overwritePreset, renamePreset, deletePreset } =
    useBacktestPresetsStore();
  const addRun = useBacktestHistoryStore((s) => s.addRun);
  // Inputs of the run that was just saved: the form may have been edited since.
  const latestRunParams = useBacktestHistoryStore((s) => s.runs[0]?.params);

  const params: BacktestParams = {
    from,
    to,
    signals: selected,
    slippageBps,
    feeBps,
  };

  useEffect(() => {
    if (!retryId) return;
    const failure = getFailure(retryId);
    if (!failure) {
      setRetryProblem("That failed run is no longer saved, so its settings cannot be restored.");
      return;
    }
    const eligibility = retryEligibility(failure);
    if (!eligibility.eligible) {
      setRetryProblem(`This run cannot be retried: ${eligibility.reason}`);
      return;
    }
    setFrom(failure.params.from);
    setTo(failure.params.to);
    setSelected(failure.params.signals);
    setSlippageBps(failure.params.slippageBps ?? DEFAULT_BACKTEST_PARAMS.slippageBps);
    setFeeBps(failure.params.feeBps ?? DEFAULT_BACKTEST_PARAMS.feeBps);
    setRetryInfo({ id: failure.id, differences: diffAgainstDefaults(failure.params), error: failure.error });
    setRetryProblem(null);
  }, [retryId, getFailure]);

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const r = await runBacktest(params);
      setResult(r);
      setResultParams(params);
      addRun(params, r);
      if (retryInfo) {
        removeFailure(retryInfo.id);
        setRetryInfo(null);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Simulation failed";
      setError(message);
      recordFailure(params, message, retryInfo?.id);
    } finally {
      setLoading(false);
    }
  }

  const paramsValid = Boolean(from && to && from <= to);
  const trimmedPresetName = presetName.trim();
  const existingPreset = presets.find(
    (p) => p.name.toLowerCase() === trimmedPresetName.toLowerCase()
  );

  function announce(message: string) {
    setPresetStatus(message);
    toast.success(message);
  }

  function handleSavePreset() {
    if (!trimmedPresetName || !paramsValid) return;
    if (existingPreset) {
      overwritePreset(existingPreset.id, params);
      announce(`Preset "${existingPreset.name}" overwritten`);
    } else {
      savePreset(trimmedPresetName, params);
      announce(`Preset "${trimmedPresetName}" saved`);
    }
    setPresetName("");
    setShowSaveInput(false);
  }

  function handleLoadPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setFrom(preset.params.from);
    setTo(preset.params.to);
    setSelected(preset.params.signals);
    setSlippageBps(preset.params.slippageBps ?? 10);
    setFeeBps(preset.params.feeBps ?? 10);
    setPresetStatus(`Preset "${preset.name}" applied`);
  }

  function startRename(id: string, name: string) {
    setConfirmDeleteId(null);
    setRenamingId(id);
    setRenameValue(name);
    setConfirmRename(false);
  }

  function cancelRename() {
    setRenamingId(null);
    setConfirmRename(false);
  }

  function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    if (presets.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
      setPresetStatus(`A preset named "${name}" already exists`);
      toast.error(`A preset named "${name}" already exists`);
      return;
    }
    if (!confirmRename) {
      setConfirmRename(true);
      return;
    }
    renamePreset(id, name);
    cancelRename();
    announce(`Preset renamed to "${name}"`);
  }

  function handleDelete(id: string, name: string) {
    deletePreset(id);
    setConfirmDeleteId(null);
    announce(`Preset "${name}" deleted`);
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p role="status" aria-live="polite" className="sr-only" data-testid="preset-status">
        {presetStatus}
      </p>

      {retryProblem && (
        <p role="alert" className="mb-4 rounded bg-red-500/10 px-3 py-2 text-sm text-red-300" data-testid="retry-problem">
          {retryProblem}
        </p>
      )}
      {retryInfo && (
        <div
          role="region"
          aria-label="Retrying a failed simulation"
          className="mb-4 rounded border border-amber-400/30 bg-amber-400/5 p-3 text-sm"
          data-testid="retry-banner"
        >
          <p className="font-medium">Settings restored from a failed simulation</p>
          <p className="text-xs text-gray-400">It failed with: {retryInfo.error}</p>
          {retryInfo.differences.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-200" aria-label="Differences from current defaults">
              {retryInfo.differences.map((d) => (
                <li key={d.field}>
                  {d.label}: {d.saved} (default is {d.current})
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-gray-400">These settings match the current defaults.</p>
          )}
          <Button size="sm" className="mt-3" onClick={handleRun} disabled={loading}>
            {loading ? "Running…" : "Retry run"}
          </Button>
        </div>
      )}

      {/* Presets */}
      {presets.length > 0 && (
        <div className="mb-4">
          <span className="text-xs text-foreground-muted block mb-1">
            Load Preset
          </span>
          <ul className="flex flex-wrap gap-2" aria-label="Saved presets">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                {renamingId === p.id ? (
                  <>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => {
                        setRenameValue(e.target.value);
                        setConfirmRename(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(p.id);
                        if (e.key === "Escape") cancelRename();
                      }}
                      aria-label={`New name for preset ${p.name}`}
                      className="text-xs px-2 py-1 bg-white/10 rounded border border-white/20"
                      data-testid={`preset-rename-input-${p.id}`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(p.id)}
                      disabled={!renameValue.trim()}
                      aria-label={
                        confirmRename
                          ? `Confirm rename to ${renameValue.trim()}`
                          : `Rename preset ${p.name}`
                      }
                      className="text-xs text-green-400 hover:text-green-300"
                      data-testid={`preset-rename-confirm-${p.id}`}
                    >
                      {confirmRename ? "Confirm rename?" : <Check size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      aria-label="Cancel rename"
                      className="text-foreground-muted"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : confirmDeleteId === p.id ? (
                  <>
                    <span className="text-xs">Delete &ldquo;{p.name}&rdquo;?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-xs text-red-400 hover:text-red-300"
                      data-testid={`preset-delete-confirm-${p.id}`}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-foreground-muted"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(p.id)}
                      className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                      data-testid={`preset-load-${p.id}`}
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(p.id, p.name)}
                      aria-label={`Rename preset ${p.name}`}
                      className="text-foreground-muted hover:text-foreground"
                      data-testid={`preset-rename-${p.id}`}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cancelRename();
                        setConfirmDeleteId(p.id);
                      }}
                      aria-label={`Delete preset ${p.name}`}
                      className="text-red-400 hover:text-red-300"
                      data-testid={`preset-delete-${p.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inputs */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label htmlFor="backtest-from" className="text-xs text-foreground-muted block mb-1">
            From
          </label>
          <input
            id="backtest-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block"
          />
        </div>
        <div>
          <label htmlFor="backtest-to" className="text-xs text-foreground-muted block mb-1">To</label>
          <input
            id="backtest-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="block"
          />
        </div>
        <div>
          <label htmlFor="backtest-signals" className="text-xs text-foreground-muted block mb-1">
            Providers / Signals
          </label>
          <select
            id="backtest-signals"
            multiple
            value={selected}
            onChange={(e) =>
              setSelected(
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            className="block"
          >
            <option value="providerA">Provider A</option>
            <option value="providerB">Provider B</option>
            <option value="signalX">Signal X</option>
            <option value="signalY">Signal Y</option>
          </select>
        </div>
        <div>
          <label htmlFor="backtest-slippage" className="text-xs text-foreground-muted block mb-1">
            Slippage (bps)
          </label>
          <input
            id="backtest-slippage"
            type="number"
            min={0}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            className="block w-20"
          />
        </div>
        <div>
          <label htmlFor="backtest-fee" className="text-xs text-foreground-muted block mb-1">
            Fee (bps)
          </label>
          <input
            id="backtest-fee"
            type="number"
            min={0}
            value={feeBps}
            onChange={(e) => setFeeBps(Number(e.target.value))}
            className="block w-20"
          />
        </div>
      </div>

      {/* Save preset row */}
      <div className="flex items-center gap-2 mb-4">
        {showSaveInput ? (
          <>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              aria-label="Preset name"
              className="text-sm px-2 py-1 bg-white/10 rounded border border-white/20 focus:outline-none"
              data-testid="preset-name-input"
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleSavePreset}
              disabled={!trimmedPresetName || !paramsValid}
              data-testid="preset-save-confirm"
            >
              {existingPreset ? "Overwrite" : "Save"}
            </Button>
            {!paramsValid && (
              <span className="text-xs text-red-400">
                Fix the date range before saving
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowSaveInput(false);
                setPresetName("");
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSaveInput(true)}
            className="gap-2"
            data-testid="preset-save-open"
          >
            <Save className="h-3 w-3" />
            Save as preset
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6" data-testid="backtest-actions">
        <Button onClick={handleRun} disabled={loading} className="bg-purple-500 text-white">
          {loading ? "Running…" : "Run Simulation"}
        </Button>
        <Button
          variant="outline"
          disabled={!result}
          onClick={() => result && exportCSV(params, result)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          disabled={!result}
          onClick={() => result && exportJSON(params, result)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
        <Link href="/backtest-sim/history">
          <Button variant="outline" className="gap-2">
            <History className="h-4 w-4" />
            History
          </Button>
        </Link>
      </div>

      {/* Error */}
      {error && <p className="text-red-400 mb-4">{error}</p>}

      {/* Results */}
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Total Return</p>
              <p className="text-lg font-semibold">
                {(result.totalReturn * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-white/5 rounded p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Win Rate</p>
              <p className="text-lg font-semibold">
                {(result.winRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white/5 rounded p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
              <p className="text-lg font-semibold">
                {(result.maxDrawdown * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          <BacktestBaselineCard params={resultParams ?? params} result={result} />
          <BacktestDrawdownInspector result={result} />

          {result.trades.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-1 pr-4">{t.time}</td>
                      <td
                        className={`py-1 ${
                          t.pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {t.pnl >= 0 ? "+" : ""}
                        {t.pnl.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <BacktestNoTradesExplainer params={latestRunParams ?? params} result={result} />
        </div>
      ) : (
        !loading && (
          <p className="text-gray-400">
            Simulated results, win rate, drawdown and trades will appear here
            after running the simulation.
          </p>
        )
      )}
    </div>
  );
}
