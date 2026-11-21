"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, Trash2, Printer, GitCompare, Link as LinkIcon, Check, ChevronLeft, ChevronRight, Image as ImageIcon, Download, AlertCircle, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PageTransition } from "@/components/PageTransition";
import { useComparisonStore } from "@/store/useComparisonStore";
import { MetricToggleBar } from "@/components/comparison/MetricToggleBar";
import { SnapshotNameField } from "@/components/comparison/SnapshotNameField";
import { fetchSignals } from "@/lib/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { ComparisonErrorBoundary } from "@/components/ComparisonErrorBoundary";
import { ExportPreviewDialog } from "@/components/ExportPreviewDialog";
import { downloadComparisonCsv, downloadComparisonImage } from "@/lib/exportComparison";
import { toast } from "@/lib/toast";

const ComparisonCard = dynamic(
  () =>
    import("@/components/comparison/ComparisonCard").then(
      (m) => m.ComparisonCard
    ),
  {
    loading: () => <div className="animate-pulse h-48 bg-white/5 rounded-xl" />,
    ssr: false,
  }
);
const ComparisonChart = dynamic(
  () =>
    import("@/components/comparison/ComparisonChart").then(
      (m) => m.ComparisonChart
    ),
  {
    loading: () => <div className="animate-pulse h-32 bg-white/5 rounded-xl" />,
    ssr: false,
  }
);
const AddSignalPanel = dynamic(
  () =>
    import("@/components/comparison/AddSignalPanel").then(
      (m) => m.AddSignalPanel
    ),
  {
    loading: () => <div className="animate-pulse h-20 bg-white/5 rounded" />,
    ssr: false,
  }
);

function computeBestValues(
  signals: ReturnType<typeof useComparisonStore.getState>["signals"]
): Record<string, number> {
  const best: Record<string, number> = {};

  const update = (
    key: string,
    val: number | undefined,
    higherIsBetter: boolean
  ) => {
    if (val == null || isNaN(val)) return;
    if (best[key] == null) {
      best[key] = val;
      return;
    }
    if (higherIsBetter ? val > best[key] : val < best[key]) best[key] = val;
  };

  for (const s of signals) {
    update("confidence", s.confidence, true);
    update("entryPrice", undefined, false);
    update("targetPrice", undefined, true);
    update("stopLoss", undefined, false);
    const rr = undefined;
    update("riskReward", rr, true);
  }

  return best;
}

function ComparePageContent() {
  const { t } = useI18n();
  const {
    signals,
    removeSignal,
    clearSignals,
    hiddenMetrics,
    toggleMetric,
    canAdd,
    addSignal,
    limitReached,
    dismissLimitMessage,
  } = useComparisonStore();
  const prefersReduced = useReducedMotion();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [pendingExport, setPendingExport] = useState<
    "csv" | "image" | "pdf" | null
  >(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "image" | "pdf">(
    "csv"
  );
  const tableRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 639px)");

  // On mount: restore comparison from URL ?ids=a,b,c
  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids || signals.length > 0) return;
    const idList = ids.split(",").filter(Boolean).slice(0, 3);

    // Guard against writing to the (global) comparison store after this
    // view has been navigated away from — a late response for an
    // abandoned /compare visit must not silently populate the store for
    // whatever page the user has since navigated to.
    let cancelled = false;
    const controller = new AbortController();
    fetchSignals({ signal: controller.signal })
      .then((all) => {
        if (cancelled) return;
        for (const id of idList) {
          const found = all.items.find((s) => s.id === id);
          if (found) addSignal(found);
        }
      })
      .catch(() => {
        // gracefully ignore — signal may no longer exist, or the request
        // was cancelled because this view was abandoned
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with current selection
  useEffect(() => {
    const ids = signals.map((s) => s.id).join(",");
    const params = ids ? `?ids=${ids}` : "";
    router.replace(`/compare${params}`, { scroll: false });
  }, [signals, router]);

  const handleCopyShareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Share link copied", {
        description: "Anyone with this link will see the same comparison.",
        duration: 2500,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link", {
        description: "Your browser blocked clipboard access. Copy the URL from the address bar instead.",
        duration: 4000,
      });
    }
  };

  const bestValues = computeBestValues(signals);

  const tickerSummary = signals.map((s) => s.ticker).join(", ");

  const exportPreviewConfig: Record<
    "csv" | "image" | "pdf",
    {
      title: string;
      description: string;
      confirmLabel: string;
      items: { label: string; value: string }[];
    }
  > = {
    csv: {
      title: "Export comparison as CSV",
      description:
        "A spreadsheet with one row per signal will download to your device.",
      confirmLabel: "Download CSV",
      items: [
        { label: "Format", value: "CSV (.csv)" },
        { label: "Signals included", value: tickerSummary || "—" },
        { label: "Filename", value: "signal-comparison.csv" },
      ],
    },
    image: {
      title: "Export comparison as image",
      description:
        "A PNG snapshot of the current comparison table will download to your device.",
      confirmLabel: "Download image",
      items: [
        { label: "Format", value: "PNG image" },
        { label: "Signals included", value: tickerSummary || "—" },
        { label: "Filename", value: "signal-comparison.png" },
      ],
    },
    pdf: {
      title: "Export comparison as PDF",
      description:
        "Your browser's print dialog will open — choose \"Save as PDF\" to export.",
      confirmLabel: "Open print dialog",
      items: [
        { label: "Format", value: "PDF (via print)" },
        { label: "Signals included", value: tickerSummary || "—" },
      ],
    },
  };

  const handleExport = () => setPendingExport(exportFormat);

  const runPendingExport = async () => {
    if (pendingExport === "csv") {
      downloadComparisonCsv(signals);
      toast.success("CSV downloaded", {
        description: t("compare.export_success", { count: signals.length }),
      });
      return;
    }

    if (pendingExport === "image") {
      if (!tableRef.current) {
        throw new Error("Nothing to capture — the comparison table isn't visible.");
      }
      setExportingImage(true);
      try {
        await downloadComparisonImage(tableRef.current);
        toast.success("Image downloaded", {
          description: "A PNG snapshot was saved to your device.",
        });
      } finally {
        setExportingImage(false);
      }
      return;
    }

    if (pendingExport === "pdf") {
      window.print();
    }
  };

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <GitCompare
                className="h-6 w-6 text-blue-400"
                aria-hidden="true"
              />
              <div>
                <h1 className="text-2xl font-bold">Signal Comparison</h1>
                <p className="text-sm text-gray-400">Compare up to 3 signals side-by-side</p>
                {signals.length > 0 && (
                  <div className="mt-1">
                    <SnapshotNameField />
                  </div>
                )}
                <p className="text-sm text-gray-400">
                  Compare up to 3 signals side-by-side
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {signals.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShareLink}
                    className="gap-2"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                    {copied ? "Copied!" : "Share Link"}
                  </Button>
                  <label htmlFor="export-format" className="sr-only">
                    Export format
                  </label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(e) =>
                      setExportFormat(
                        e.target.value as "csv" | "image" | "pdf"
                      )
                    }
                    disabled={exportingImage}
                    className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="csv">CSV (.csv)</option>
                    <option value="image">Image (.png)</option>
                    <option value="pdf">PDF (print)</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exportingImage}
                    className="gap-2"
                  >
                    {exportFormat === "pdf" ? (
                      <Printer className="h-4 w-4" />
                    ) : exportFormat === "image" ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exportingImage ? "Capturing…" : "Export"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSignals}
                    className="gap-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </Button>
                </>
              )}
              {canAdd() && (
                <Button
                  size="sm"
                  onClick={() => setAddPanelOpen((v) => !v)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Signal
                </Button>
              )}
            </div>
          </div>

          {/* Add signal panel — inline on tablet/desktop */}
          <AnimatePresence>
            {addPanelOpen && (
              <motion.div
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={prefersReduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={prefersReduced ? { duration: 0 } : undefined}
                className="hidden overflow-hidden mb-6 sm:block"
              >
                <div className="rounded-xl border border-white/10 bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-300">
                      Select signals to compare
                    </h2>
                    <span className="text-xs text-gray-500">
                      {signals.length}/3 selected
                    </span>
                  </div>
                  <AddSignalPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add signal panel — bottom sheet on mobile */}
          <BottomSheet
            open={addPanelOpen}
            onClose={() => setAddPanelOpen(false)}
            ariaLabel="Select signals to compare"
            className="sm:hidden"
            title="Select signals to compare"
            headerExtra={
              <span className="text-xs text-gray-500">
                {signals.length}/3 selected
              </span>
            }
          >
            <div className="px-4 pb-6">
              <AddSignalPanel />
            </div>
          </BottomSheet>

          {/* Limit-reached banner */}
          <AnimatePresence>
            {limitReached && (
              <motion.div
                key="limit-banner"
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={prefersReduced ? { duration: 0 } : undefined}
                role="alert"
                aria-live="polite"
                className="flex items-center justify-between gap-3 mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 print:hidden"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    You can compare up to {3} signals at once. Remove one to add
                    another.
                  </span>
                </div>
                <button
                  onClick={dismissLimitMessage}
                  aria-label="Dismiss"
                  className="shrink-0 rounded p-0.5 hover:bg-amber-500/20 transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {signals.length === 0 ? (
            <EmptyState
              className="py-24"
              icon={<GitCompare className="h-8 w-8 text-sky-400/80" />}
              title="No signals selected"
              description="Add up to 3 signals to compare their metrics, entry/exit points, and performance side-by-side."
              action={
                <Button onClick={() => setAddPanelOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Signal
                </Button>
              }
            />
          ) : (
            <ComparisonErrorBoundary>
              {/* Metric toggles */}
              <div className="mb-6 print:hidden">
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                  Toggle Columns
                </p>
                <MetricToggleBar
                  hiddenMetrics={hiddenMetrics}
                  onToggle={toggleMetric}
                />
              </div>

              {/* ── Desktop: side-by-side split view ── */}
              {!isMobile && (
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4" style={{ minWidth: `${signals.length * 220}px` }}>
                    {signals.map((signal) => (
                      <motion.div
                        key={signal.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1"
                        style={{ minWidth: 200 }}
                      >
                        <ComparisonCard
                          signal={signal}
                          onRemove={() => removeSignal(signal.id)}
                          hiddenMetrics={hiddenMetrics}
                          bestValues={bestValues}
                        />
                      </motion.div>
                    ))}

                    {/* Placeholder slot when fewer than 3 */}
                    {canAdd() && (
                      <div
                        className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-white/10 min-h-[200px] cursor-pointer hover:border-white/20 transition-colors print:hidden"
                        style={{ minWidth: 200 }}
                        onClick={() => setAddPanelOpen(true)}
                        role="button"
                        aria-label="Add another signal"
                      >
                        <div className="text-center text-gray-600">
                          <Plus className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Add signal</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Mobile: tabbed single-card view ── */}
              {isMobile && (
                <div>
                  {/* Tab bar */}
                  <div
                    role="tablist"
                    aria-label="Compare signals"
                    className="flex gap-2 mb-4 overflow-x-auto pb-1"
                  >
                    {signals.map((signal, index) => (
                      <button
                        key={signal.id}
                        role="tab"
                        aria-selected={index === activeMobileIndex}
                        aria-controls={`comparison-panel-${signal.id}`}
                        id={`comparison-tab-${signal.id}`}
                        tabIndex={index === activeMobileIndex ? 0 : -1}
                        onClick={() => setActiveMobileIndex(index)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                          index === activeMobileIndex
                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                            : "bg-gray-800 text-gray-400 border border-white/10 hover:border-white/20"
                        )}
                      >
                        {signal.action === "BUY" ? (
                          <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                        )}
                        {signal.ticker}
                      </button>
                    ))}
                    {canAdd() && (
                      <button
                        onClick={() => setAddPanelOpen(true)}
                        className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 border border-dashed border-white/10 hover:border-white/20 transition-colors shrink-0"
                        aria-label="Add signal to comparison"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        Add
                      </button>
                    )}
                  </div>

                  {/* Navigation arrows */}
                  {signals.length > 1 && (
                    <div className="flex items-center justify-between mb-3 print:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveMobileIndex((i) => Math.max(0, i - 1))}
                        disabled={activeMobileIndex === 0}
                        className="gap-1 text-xs"
                        aria-label="Previous signal"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <span className="text-xs text-gray-500" aria-live="polite">
                        {activeMobileIndex + 1} / {signals.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveMobileIndex((i) => Math.min(signals.length - 1, i + 1))}
                        disabled={activeMobileIndex === signals.length - 1}
                        className="gap-1 text-xs"
                        aria-label="Next signal"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Active card panel — preserves scroll context per card */}
                  <AnimatePresence mode="wait">
                    {signals[activeMobileIndex] && (
                      <motion.div
                        key={signals[activeMobileIndex].id}
                        role="tabpanel"
                        id={`comparison-panel-${signals[activeMobileIndex].id}`}
                        aria-labelledby={`comparison-tab-${signals[activeMobileIndex].id}`}
                        tabIndex={0}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ComparisonCard
                          signal={signals[activeMobileIndex]}
                          onRemove={() => {
                            removeSignal(signals[activeMobileIndex].id);
                            // Clamp index after removal
                            setActiveMobileIndex((i) => Math.min(i, Math.max(0, signals.length - 2)));
                          }}
                          hiddenMetrics={hiddenMetrics}
                          bestValues={bestValues}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Performance chart */}
              {signals.length >= 2 && (
                <div className="mt-8 rounded-xl border border-white/10 bg-gray-900 p-6">
                  <h2 className="text-sm font-semibold text-gray-300 mb-5">
                    Performance Comparison
                  </h2>
                  <ComparisonChart signals={signals} />
                </div>
              )}
            </ComparisonErrorBoundary>
          )}
        </div>
      </main>

      {/* Export preview & confirmation dialog */}
      {pendingExport && (
        <ExportPreviewDialog
          open={pendingExport !== null}
          onOpenChange={(open) => {
            if (!open) setPendingExport(null);
          }}
          title={exportPreviewConfig[pendingExport].title}
          description={exportPreviewConfig[pendingExport].description}
          items={exportPreviewConfig[pendingExport].items}
          confirmLabel={exportPreviewConfig[pendingExport].confirmLabel}
          onConfirm={runPendingExport}
        />
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            background: white;
            color: black;
          }
          .bg-gray-950,
          .bg-gray-900 {
            background: #f9fafb !important;
          }
          .text-white {
            color: #111 !important;
          }
          .border-white\\/10 {
            border-color: #e5e7eb !important;
          }
        }
      `}</style>
    </PageTransition>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <ComparePageContent />
    </Suspense>
  );
}
