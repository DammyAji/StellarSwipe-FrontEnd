import type { BacktestParams } from "@/lib/backtest";

export interface SnapshotRow {
  key: string;
  label: string;
  value: string;
  /** False when the run did not capture this input. */
  captured: boolean;
}

export interface ConfigSnapshot {
  runId: string;
  capturedAt: number;
  rows: readonly SnapshotRow[];
  /** Labels of the inputs this run did not capture. */
  missing: readonly string[];
  /** True when any input the tool collects is absent from the saved run. */
  partial: boolean;
}

interface SnapshotSource {
  id: string;
  timestamp: number;
  params: Partial<BacktestParams> | undefined;
}

const NOT_CAPTURED = "Not captured";

/**
 * Immutable view of the inputs saved with a run. The values are copied and frozen
 * so later edits to the history never change what a snapshot shows. Runs saved
 * before an input was recorded are marked partial, never filled with defaults.
 */
export function buildConfigSnapshot(run: SnapshotSource): ConfigSnapshot {
  const p = run.params ?? {};
  const rows: SnapshotRow[] = [
    { key: "from", label: "Start date", value: p.from || NOT_CAPTURED, captured: Boolean(p.from) },
    { key: "to", label: "End date", value: p.to || NOT_CAPTURED, captured: Boolean(p.to) },
    {
      key: "signals",
      label: "Signals",
      value: Array.isArray(p.signals) ? (p.signals.length > 0 ? p.signals.join(", ") : "None selected") : NOT_CAPTURED,
      captured: Array.isArray(p.signals),
    },
    {
      key: "feeBps",
      label: "Fee (bps)",
      value: typeof p.feeBps === "number" ? String(p.feeBps) : NOT_CAPTURED,
      captured: typeof p.feeBps === "number",
    },
    {
      key: "slippageBps",
      label: "Slippage (bps)",
      value: typeof p.slippageBps === "number" ? String(p.slippageBps) : NOT_CAPTURED,
      captured: typeof p.slippageBps === "number",
    },
  ];
  // Optional inputs appear only when the run recorded them.
  if (typeof p.startingCapital === "number") {
    rows.push({ key: "startingCapital", label: "Starting capital", value: String(p.startingCapital), captured: true });
  }
  if (p.asset) rows.push({ key: "asset", label: "Asset", value: p.asset, captured: true });

  const frozenRows = rows.map((row) => Object.freeze({ ...row }));
  const missing = frozenRows.filter((r) => !r.captured).map((r) => r.label);
  return Object.freeze({
    runId: run.id,
    capturedAt: run.timestamp,
    rows: Object.freeze(frozenRows),
    missing: Object.freeze(missing),
    partial: missing.length > 0,
  });
}
