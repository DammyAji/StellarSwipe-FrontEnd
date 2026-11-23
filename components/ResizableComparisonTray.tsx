"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface ComparisonItem {
  id: string;
  name: string;
}

export interface ComparisonSeriesPoint {
  /** ISO date string for the period bucket. */
  date: string;
  /** Gross value; omit when history is unavailable for this point. */
  gross?: number | null;
  /** Fee-adjusted value; omit when fee inputs are unavailable. */
  adjusted?: number | null;
}

export interface ComparisonWalletSeries {
  id: string;
  /** Legend label shown for the wallet. */
  label: string;
  points: ComparisonSeriesPoint[];
}

export interface ComparisonBenchmark {
  /** Legend label for the gross benchmark series. */
  grossLabel: string;
  /** Legend label for the fee-adjusted benchmark series. */
  adjustedLabel: string;
  points: ComparisonSeriesPoint[];
  /** Human-readable fee assumptions, e.g. "0.25% annual fee". */
  assumptions?: string;
  /** True when fee inputs are incomplete and adjusted values are partial. */
  feeDataIncomplete?: boolean;
}

export type ComparisonStatus = "idle" | "loading" | "error" | "ready";

interface ResizableComparisonTrayProps {
  items: ComparisonItem[];
  onRemove: (id: string) => void;
  onCompare: (ids: string[]) => void;
  defaultHeight?: number;
  /** Wallet performance series to compare. */
  walletSeries?: ComparisonWalletSeries[];
  /** Optional fee-adjusted benchmark rendered alongside wallet series. */
  benchmark?: ComparisonBenchmark | null;
  /** Shared date range label for all plotted series. */
  dateRangeLabel?: string;
  /** Loading/error state for the comparison data. */
  status?: ComparisonStatus;
  /** Error message shown when status is "error". */
  errorMessage?: string;
  /** Retry handler for the error state. */
  onRetry?: () => void;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 400;
const STORAGE_KEY = "comparison-tray-height";

const SERIES_COLORS = [
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

function formatValue(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function ResizableComparisonTray({
  items,
  onRemove,
  onCompare,
  defaultHeight = 160,
  walletSeries = [],
  benchmark = null,
  dateRangeLabel,
  status = "ready",
  errorMessage,
  onRetry,
}: ResizableComparisonTrayProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(defaultHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    walletSeries.map((s) => s.id)
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      const available = new Set(walletSeries.map((s) => s.id));
      const kept = prev.filter((id) => available.has(id));
      const added = walletSeries
        .map((s) => s.id)
        .filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [walletSeries]);

  const toggleWallet = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectedSeries = walletSeries.filter((s) => selectedIds.includes(s.id));
  const hasPlottableData =
    selectedSeries.some((s) =>
      s.points.some((p) => p.gross != null || p.adjusted != null)
    ) ||
    (benchmark?.points.some((p) => p.gross != null || p.adjusted != null) ??
      false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const h = parseInt(stored, 10);
      if (!isNaN(h) && h >= MIN_HEIGHT && h <= MAX_HEIGHT) setHeight(h);
    }
  }, []);

  const saveHeight = useCallback((h: number) => {
    setHeight(h);
    localStorage.setItem(STORAGE_KEY, String(h));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = collapsed ? MIN_HEIGHT : height;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [collapsed, height]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight.current + delta));
      if (collapsed) setCollapsed(false);
      saveHeight(next);
    },
    [collapsed, saveHeight]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface shadow-lg"
      style={{
        height: collapsed ? MIN_HEIGHT : height,
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div
        className="flex h-2 cursor-ns-resize items-center justify-center hover:bg-surface-high/20 transition-colors"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="Resize comparison tray"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={collapsed ? MIN_HEIGHT : height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
      >
        <div className="h-1 w-8 rounded-full bg-foreground-muted/30" />
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-medium">
          {t("comparison.items_selected", { count: items.length })}
        </span>
        <div className="flex items-center gap-2">
          {items.length >= 2 && (
            <button
              onClick={() => onCompare(items.map((i) => i.id))}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Compare
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand tray" : "Collapse tray"}
            className="rounded-md p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-high/10 transition-colors"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex max-h-[calc(100%-5rem)] flex-col gap-3 overflow-y-auto px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-high/10 px-3 py-1 text-xs"
              >
                {item.name}
                <button
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="rounded-full p-0.5 hover:bg-surface-high/30 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {walletSeries.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-foreground-muted">
                {t("comparison.wallets")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {walletSeries.map((series, index) => {
                  const checked = selectedIds.includes(series.id);
                  const color = SERIES_COLORS[index % SERIES_COLORS.length];
                  return (
                    <label
                      key={series.id}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                        checked
                          ? "border-border bg-surface-high/20"
                          : "border-border/50 text-foreground-muted"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleWallet(series.id)}
                      />
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {series.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {dateRangeLabel && (
            <p className="text-xs text-foreground-muted">{dateRangeLabel}</p>
          )}

          {status === "loading" && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-foreground-muted"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground-muted/30 border-t-foreground-muted" />
              {t("comparison.loading")}
            </div>
          )}

          {status === "error" && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-xs text-red-600 dark:text-red-400"
            >
              <span>{errorMessage ?? t("comparison.error")}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="rounded-md border border-border px-2 py-0.5 hover:bg-surface-high/20 transition-colors"
                >
                  {t("comparison.retry")}
                </button>
              )}
            </div>
          )}

          {status === "ready" && !hasPlottableData && (
            <p className="text-xs text-foreground-muted">
              {t("comparison.empty")}
            </p>
          )}

          {status === "ready" && hasPlottableData && (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {selectedSeries.map((series) => {
                  const index = walletSeries.findIndex(
                    (s) => s.id === series.id
                  );
                  const color =
                    SERIES_COLORS[index % SERIES_COLORS.length];
                  return (
                    <li key={series.id} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {series.label}
                    </li>
                  );
                })}
                {benchmark && (
                  <>
                    <li className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-4 border-t-2 border-dashed border-foreground-muted"
                      />
                      {benchmark.grossLabel}
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-4 border-t-2 border-dotted border-foreground-muted"
                      />
                      {benchmark.adjustedLabel}
                    </li>
                  </>
                )}
              </ul>

              <div className="flex flex-col gap-1 text-xs">
                {selectedSeries.map((series) => {
                  const last = [...series.points]
                    .reverse()
                    .find((p) => p.gross != null || p.adjusted != null);
                  return (
                    <div
                      key={series.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{series.label}</span>
                      <span className="tabular-nums text-foreground-muted">
                        {last?.gross != null
                          ? formatValue(last.gross)
                          : t("comparison.no_history")}
                      </span>
                    </div>
                  );
                })}
                {benchmark && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{benchmark.adjustedLabel}</span>
                    <span className="tabular-nums text-foreground-muted">
                      {(() => {
                        const last = [...benchmark.points]
                          .reverse()
                          .find((p) => p.adjusted != null);
                        return last?.adjusted != null
                          ? formatValue(last.adjusted)
                          : t("comparison.no_history");
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {benchmark && (
                <div className="flex flex-col gap-1 text-xs text-foreground-muted">
                  {benchmark.assumptions && (
                    <p>{benchmark.assumptions}</p>
                  )}
                  {benchmark.feeDataIncomplete && (
                    <p role="note">{t("comparison.fee_data_incomplete")}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
