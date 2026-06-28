"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Printer, GitCompare, Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { useComparisonStore } from "@/store/useComparisonStore";
import { MetricToggleBar } from "@/components/comparison/MetricToggleBar";
import { fetchSignals } from "@/lib/api";
import { ComparisonErrorBoundary } from "@/components/ComparisonErrorBoundary";

const ComparisonCard = dynamic(
  () => import("@/components/comparison/ComparisonCard").then((m) => m.ComparisonCard),
  { loading: () => <div className="animate-pulse h-48 bg-white/5 rounded-xl" />, ssr: false }
);
const ComparisonChart = dynamic(
  () => import("@/components/comparison/ComparisonChart").then((m) => m.ComparisonChart),
  { loading: () => <div className="animate-pulse h-32 bg-white/5 rounded-xl" />, ssr: false }
);
const AddSignalPanel = dynamic(
  () => import("@/components/comparison/AddSignalPanel").then((m) => m.AddSignalPanel),
  { loading: () => <div className="animate-pulse h-20 bg-white/5 rounded" />, ssr: false }
);

function computeBestValues(signals: ReturnType<typeof useComparisonStore.getState>["signals"]): Record<string, number> {
  const best: Record<string, number> = {};

  const update = (key: string, val: number | undefined, higherIsBetter: boolean) => {
    if (val == null || isNaN(val)) return;
    if (best[key] == null) { best[key] = val; return; }
    if (higherIsBetter ? val > best[key] : val < best[key]) best[key] = val;
  };

  for (const s of signals) {
    update("confidence", s.confidence, true);
    update("entryPrice", s.stats?.entryPrice, false);
    update("targetPrice", s.stats?.targetPrice, true);
    update("stopLoss", s.stats?.stopLoss, false);
    const rr = s.stats?.riskReward ? parseFloat(s.stats.riskReward) : undefined;
    update("riskReward", rr, true);
  }

  return best;
}

function ComparePageContent() {
  const { signals, removeSignal, clearSignals, hiddenMetrics, toggleMetric, canAdd, addSignal } = useComparisonStore();
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // On mount: restore comparison from URL ?ids=a,b,c
  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids || signals.length > 0) return;
    const idList = ids.split(",").filter(Boolean).slice(0, 3);
    fetchSignals()
      .then((all) => {
        for (const id of idList) {
          const found = all.find((s) => s.id === id);
          if (found) addSignal(found);
        }
      })
      .catch(() => {
        // gracefully ignore — signal may no longer exist
      });
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
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bestValues = computeBestValues(signals);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <PageTransition>
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <GitCompare className="h-6 w-6 text-blue-400" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-bold">Signal Comparison</h1>
                <p className="text-sm text-gray-400">Compare up to 3 signals side-by-side</p>
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {signals.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCopyShareLink} className="gap-2">
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <LinkIcon className="h-4 w-4" />}
                    {copied ? "Copied!" : "Share Link"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSignals} className="gap-2 text-red-400 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                    Clear All
                  </Button>
                </>
              )}
              {canAdd() && (
                <Button size="sm" onClick={() => setAddPanelOpen((v) => !v)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Signal
                </Button>
              )}
            </div>
          </div>

          {/* Add signal panel */}
          <AnimatePresence>
            {addPanelOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="rounded-xl border border-white/10 bg-gray-900 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-300">Select signals to compare</h2>
                    <span className="text-xs text-gray-500">{signals.length}/3 selected</span>
                  </div>
                  <AddSignalPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {signals.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <GitCompare className="h-12 w-12 text-gray-700 mb-4" />
              <h2 className="text-xl font-semibold text-gray-400 mb-2">No signals selected</h2>
              <p className="text-gray-500 text-sm mb-6 max-w-sm">
                Add up to 3 signals to compare their metrics, entry/exit points, and performance side-by-side.
              </p>
              <Button onClick={() => setAddPanelOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Signal
              </Button>
            </div>
          ) : (
            <>
              {/* Metric toggles */}
              <div className="mb-6 print:hidden">
                <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Toggle Columns</p>
                <MetricToggleBar hiddenMetrics={hiddenMetrics} onToggle={toggleMetric} />
              </div>

              {/* Side-by-side cards — horizontal scroll on mobile */}
              <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
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

              {/* Performance chart */}
              {signals.length >= 2 && (
                <div className="mt-8 rounded-xl border border-white/10 bg-gray-900 p-6">
                  <h2 className="text-sm font-semibold text-gray-300 mb-5">Performance Comparison</h2>
                  <ComparisonChart signals={signals} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; color: black; }
          .bg-gray-950, .bg-gray-900 { background: #f9fafb !important; }
          .text-white { color: #111 !important; }
          .border-white\\/10 { border-color: #e5e7eb !important; }
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
