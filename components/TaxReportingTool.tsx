"use client";

import { useMemo, useRef, useState } from "react";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Globe,
  BarChart2,
  Receipt,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportPreviewDialog } from "@/components/ExportPreviewDialog";
import {
  DEFAULT_PDF_REPORT_OPTIONS,
  PdfReportPreviewDialog,
  type PdfReportOptions,
} from "@/components/PdfReportPreviewDialog";
import { ColumnVisibilityControl } from "@/components/ColumnVisibilityControl";
import { useColumnVisibility, type ColumnDef } from "@/hooks/useColumnVisibility";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useTransactionStore } from "@/store/useTransactionStore";
import {
  type TaxJurisdiction,
  type TaxableTransaction,
  type CsvPreset,
  type MultiYearSummaryRow,
  TAX_RATES,
  CSV_PRESETS,
  computeTaxReport,
  computeMultiYearSummary,
  exportToCsvWithPreset,
  exportMultiYearCsv,
  formatForTurboTax,
  formatForTaxAct,
  triggerDownload,
} from "@/lib/taxUtils";
import { TaxReviewQueue } from "@/components/TaxReviewQueue";
import { TaxYearDataNotice } from "@/components/TaxYearDataNotice";
import { TaxFormatPreview } from "@/components/TaxFormatPreview";
import { TaxReconciliation } from "@/components/TaxReconciliation";
import { TaxCategorySummary } from "@/components/TaxCategorySummary";
import { summarizeYearData, yearOptionLabel } from "@/lib/taxYearData";
import { DEFAULT_TAX_FORMAT, generateFormattedGenericCsv, type TaxFormatOptions } from "@/lib/taxFormatting";
import { TaxConversionRateDetails } from "@/components/TaxConversionRateDetails";
import { TaxLineItemSources } from "@/components/TaxLineItemSources";
import { conversionSummaryText, summarizeConversions } from "@/lib/taxConversionDetails";
import {
  TAX_CATEGORY_LABELS,
  assignCategory,
  resolveCategory,
  type CategoryAssignments,
} from "@/lib/taxCategorization";
import { validateTaxExport } from "@/lib/taxExportValidation";

const JURISDICTIONS: TaxJurisdiction[] = ["US", "UK", "EU", "CA"];

const CURRENT_YEAR = new Date().getFullYear();
// Offer the past 5 tax years for selection
const AVAILABLE_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function deriveTransactions(
  history: ReturnType<typeof useTransactionStore.getState>["history"]
): TaxableTransaction[] {
  return history
    .filter((tx) => tx.status === "SUCCEEDED")
    .map((tx) => {
      const sellPrice = parseFloat(tx.price);
      const amount = parseFloat(tx.amount);
      const fee = parseFloat(tx.fee);
      const gainFactor =
        tx.outcome === "WIN" ? 0.1 : tx.outcome === "LOSS" ? -0.08 : 0;
      const buyPrice = sellPrice / (1 + gainFactor);

      const hasForeignCurrency =
        tx.assetPair.includes("USDC") && !tx.assetPair.startsWith("USDC");

      return {
        id: tx.id,
        assetPair: tx.assetPair,
        amount,
        buyPrice,
        sellPrice,
        fee,
        timestamp: tx.timestamp,
        acquisitionDate: tx.timestamp - 90 * 24 * 60 * 60 * 1000,
        foreignCurrency: hasForeignCurrency ? "USDC" : undefined,
        conversionRate: hasForeignCurrency ? 1.0 : undefined,
        source: { hash: tx.hash, type: tx.type },
      };
    });
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icon
          size={13}
          className={cn("shrink-0", className)}
          aria-hidden="true"
        />
        <span className="text-[11px] text-foreground-muted">{label}</span>
      </div>
      <p className={cn("text-sm font-semibold leading-tight", className)}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-foreground-subtle">{sub}</p>}
    </div>
  );
}

/** Inline delta badge shown next to a value in the multi-year table */
function DeltaBadge({ delta, base }: { delta: number; base: number }) {
  if (base === 0) return null;
  const pct = ((delta) / Math.abs(base)) * 100;
  const isPos = pct >= 0;
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        isPos
          ? "bg-green-500/15 text-green-400"
          : "bg-red-500/15 text-red-400"
      )}
    >
      {isPos ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Multi-year comparison table */
function MultiYearComparisonTable({
  rows,
}: {
  rows: MultiYearSummaryRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-xs"
        aria-label="Multi-year tax comparison"
      >
        <thead>
          <tr className="border-b border-border text-foreground-muted">
            <th className="pb-2 text-left font-medium pr-4">Year</th>
            <th className="pb-2 text-right font-medium pr-4">Net Gain/Loss</th>
            <th className="pb-2 text-right font-medium pr-4">ST Gains</th>
            <th className="pb-2 text-right font-medium pr-4">LT Gains</th>
            <th className="pb-2 text-right font-medium pr-4">Total Fees</th>
            <th className="pb-2 text-right font-medium pr-4">Est. Tax</th>
            <th className="pb-2 text-right font-medium">Trades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const prevRow = rows[idx + 1]; // rows are newest-first
            const delta = prevRow
              ? row.totalGainLoss - prevRow.totalGainLoss
              : null;
            const isGain = row.totalGainLoss >= 0;
            return (
              <tr
                key={row.year}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 font-semibold text-foreground">
                  {row.year}
                </td>
                <td
                  className={cn(
                    "py-2 pr-4 text-right font-medium",
                    isGain ? "text-green-400" : "text-red-400"
                  )}
                >
                  {isGain ? "+" : ""}${Math.abs(row.totalGainLoss).toFixed(2)}
                  {delta !== null && prevRow && (
                    <DeltaBadge delta={delta} base={prevRow.totalGainLoss} />
                  )}
                </td>
                <td className="py-2 pr-4 text-right text-green-400">
                  ${row.shortTermGains.toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-right text-sky-400">
                  ${row.longTermGains.toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-right text-foreground-muted">
                  ${row.totalFees.toFixed(4)}
                </td>
                <td className="py-2 pr-4 text-right text-orange-400">
                  ${row.estimatedTaxLiability.toFixed(2)}
                </td>
                <td className="py-2 text-right text-foreground-muted">
                  {row.tradeCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ExportKind = "csv" | "pdf" | "turbotax" | "taxact" | "multi-csv";
type ExportState = "idle" | "generating" | "ready" | "failed";

/** Options captured when the export review opens (#1056). */
interface ReviewOptions {
  kind: ExportKind;
  jurisdiction: TaxJurisdiction;
  selectedYear: number;
  selectedYears: number[];
  csvPreset: CsvPreset;
  formatOptions: TaxFormatOptions;
}

export function TaxReportingTool() {
  const { history } = useTransactionStore();
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdiction>("US");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  // Multi-year comparison state
  const [multiYearMode, setMultiYearMode] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([
    CURRENT_YEAR,
    CURRENT_YEAR - 1,
    CURRENT_YEAR - 2,
  ]);
  const [csvPreset, setCsvPreset] = useState<CsvPreset>("generic");
  const [formatOptions, setFormatOptions] = useState<TaxFormatOptions>(DEFAULT_TAX_FORMAT);
  const [pendingExport, setPendingExport] = useState<ExportKind | null>(null);
  // #1056 Options are snapshotted when the review opens so the summary always
  // matches the file that gets generated, even if the form changes underneath.
  const [reviewOptions, setReviewOptions] = useState<ReviewOptions | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [lastExport, setLastExport] = useState<ExportKind | null>(null);
  // PDF preview (#781): options are kept here so they survive closing the
  // dialog to edit filters.
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfReportOptions>(DEFAULT_PDF_REPORT_OPTIONS);
  // #894 Manual categories for records that couldn't be auto-categorized.
  const [categoryAssignments, setCategoryAssignments] = useState<CategoryAssignments>({});
  // Synchronous guard so a double click can't start two generations
  const generatingRef = useRef(false);
  const isGenerating = exportState === "generating";

  const transactions = useMemo(() => deriveTransactions(history), [history]);

  const currentReport = useMemo(
    () => computeTaxReport(transactions, selectedYear, jurisdiction),
    [transactions, selectedYear, jurisdiction]
  );

  const previousReport = useMemo(
    () => computeTaxReport(transactions, selectedYear - 1, jurisdiction),
    [transactions, selectedYear, jurisdiction]
  );

  // Multi-year summary rows (sorted newest first)
  const multiYearRows = useMemo(
    () =>
      computeMultiYearSummary(
        transactions,
        [...selectedYears].sort((a, b) => b - a),
        jurisdiction
      ),
    [transactions, selectedYears, jurisdiction]
  );

  const transactionsById = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, tx])),
    [transactions]
  );

  // Which tax years have any transaction data at all (#1134).
  const yearSummaries = useMemo(() => summarizeYearData(transactions, AVAILABLE_YEARS), [transactions]);

  const yearTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) => new Date(tx.timestamp).getFullYear() === selectedYear
      ),
    [transactions, selectedYear]
  );

  // #893 Validate the export the user is previewing.
  const exportValidation = useMemo(
    () =>
      reviewOptions
        ? validateTaxExport({
            transactions,
            years:
              reviewOptions.kind === "multi-csv"
                ? reviewOptions.selectedYears
                : [reviewOptions.selectedYear],
            jurisdiction: reviewOptions.jurisdiction,
            format: reviewOptions.kind,
            assignments: categoryAssignments,
          })
        : null,
    [reviewOptions, transactions, categoryAssignments]
  );

  // #1056 Report computed from the reviewed options, so the summary and the
  // generated file always agree.
  const reviewReport = useMemo(
    () =>
      reviewOptions
        ? computeTaxReport(
            transactions,
            reviewOptions.selectedYear,
            reviewOptions.jurisdiction
          )
        : null,
    [reviewOptions, transactions]
  );

  const reviewMultiYearRows = useMemo(
    () =>
      reviewOptions?.kind === "multi-csv"
        ? computeMultiYearSummary(
            transactions,
            [...reviewOptions.selectedYears].sort((a, b) => b - a),
            reviewOptions.jurisdiction
          )
        : [],
    [reviewOptions, transactions]
  );

  /** Opens the review step with a snapshot of the current options. */
  function openReview(kind: ExportKind) {
    setReviewOptions({
      kind,
      jurisdiction,
      selectedYear,
      selectedYears: [...selectedYears],
      csvPreset,
      formatOptions: { ...formatOptions },
    });
    setPendingExport(kind);
  }

  /** Closes the review so the user can change options; selections are kept. */
  function editOptions() {
    setPendingExport(null);
    setTimeout(() => document.getElementById("jurisdiction-select")?.focus(), 0);
  }

  const rates = TAX_RATES[jurisdiction];
  const netGainLoss = currentReport.totalGainLoss;
  const isGain = netGainLoss >= 0;

  // #565 Column visibility
  const {
    visibility: colVis,
    toggle: toggleCol,
    showAll: showAllCols,
    isVisible,
  } = useColumnVisibility<TaxColumn>({
    columns: TAX_TABLE_COLUMNS,
    storageKey: "tax-table-columns-v1",
  });

  const yoyChange =
    previousReport.totalGainLoss !== 0
      ? ((netGainLoss - previousReport.totalGainLoss) /
          Math.abs(previousReport.totalGainLoss)) *
        100
      : null;

  function toggleYear(year: number) {
    setSelectedYears((prev) =>
      prev.includes(year)
        ? prev.length > 1
          ? prev.filter((y) => y !== year)
          : prev // keep at least one
        : [...prev, year]
    );
  }

  // ── Export preview configs ──────────────────────────────────────────────
  const exportPreviewConfig: Record<
    "csv" | "pdf" | "turbotax" | "taxact" | "multi-csv",
    {
      title: string;
      description: string;
      confirmLabel: string;
      items: { label: string; value: string }[];
    }
  > = {
    csv: {
      title: "Export tax report as CSV",
      description: `Your ${selectedYear} ${jurisdiction} report will download using the ${CSV_PRESETS[csvPreset].label} preset.`,
      confirmLabel: "Download CSV",
      items: [
        { label: "Tax year", value: String(selectedYear) },
        { label: "Jurisdiction", value: jurisdiction },
        { label: "Preset", value: CSV_PRESETS[csvPreset].label },
        {
          label: "Filename",
          value: `tax-report-${selectedYear}-${jurisdiction}-${csvPreset}.csv`,
        },
        {
          label: "Conversion rates",
          value: conversionSummaryText(summarizeConversions(currentReport.entries)),
        },
      ],
    },
    pdf: {
      title: "Export tax report as PDF",
      description:
        'Your browser\'s print dialog will open — choose "Save as PDF" to export.',
      confirmLabel: "Open print dialog",
      items: [
        { label: "Tax year", value: String(selectedYear) },
        { label: "Jurisdiction", value: jurisdiction },
      ],
    },
    turbotax: {
      title: "Export for TurboTax",
      description: `Your ${selectedYear} ${jurisdiction} report will download in TurboTax .txf format.`,
      confirmLabel: "Download .txf",
      items: [
        { label: "Tax year", value: String(selectedYear) },
        { label: "Jurisdiction", value: jurisdiction },
        {
          label: "Filename",
          value: `turbotax-${selectedYear}-${jurisdiction}.txf`,
        },
      ],
    },
    taxact: {
      title: "Export for TaxAct",
      description: `Your ${selectedYear} ${jurisdiction} report will download as a TaxAct-formatted CSV.`,
      confirmLabel: "Download CSV",
      items: [
        { label: "Tax year", value: String(selectedYear) },
        { label: "Jurisdiction", value: jurisdiction },
        {
          label: "Filename",
          value: `taxact-${selectedYear}-${jurisdiction}.csv`,
        },
      ],
    },
    "multi-csv": {
      title: "Export multi-year comparison as CSV",
      description: `A summary comparing ${selectedYears
        .sort((a, b) => b - a)
        .join(", ")} for ${jurisdiction} will download.`,
      confirmLabel: "Download CSV",
      items: [
        {
          label: "Years covered",
          value: selectedYears.sort((a, b) => b - a).join(", "),
        },
        { label: "Jurisdiction", value: jurisdiction },
        {
          label: "Filename",
          value: `tax-comparison-${selectedYears
            .sort((a, b) => b - a)
            .join("-")}-${jurisdiction}.csv`,
        },
      ],
    },
  };

  async function startExport(kind: ExportKind) {
    if (generatingRef.current) return;
    const validation = validateTaxExport({
      transactions,
      years: kind === "multi-csv" ? selectedYears : [selectedYear],
      jurisdiction,
      format: kind,
      assignments: categoryAssignments,
    });
    if (!validation.canDownload) {
      throw new Error("Resolve the blocking issues before downloading.");
    }
    generatingRef.current = true;
    setLastExport(kind);
    setExportState("generating");
    try {
      // Yield so the "generating" state paints before synchronous work runs
      await new Promise((resolve) => setTimeout(resolve, 0));
      runExport(kind);
      setExportState("ready");
    } catch {
      setExportState("failed");
    } finally {
      generatingRef.current = false;
    }
  }

  function runExport(kind: ExportKind) {
    if (kind === "csv") {
      const csv =
        csvPreset === "generic"
          ? generateFormattedGenericCsv(currentReport, formatOptions)
          : exportToCsvWithPreset(currentReport, csvPreset);
      triggerDownload(
        csv,
        `tax-report-${selectedYear}-${jurisdiction}-${csvPreset}.csv`,
        "text/csv"
      );
      toast.success("Tax report downloaded", {
        description: `${selectedYear} ${jurisdiction} report saved as CSV.`,
      });
      return;
    }

    if (kind === "pdf") {
      printPdf();
      return;
    }

    if (kind === "turbotax") {
      const txf = formatForTurboTax(currentReport);
      triggerDownload(
        txf,
        `turbotax-${selectedYear}-${jurisdiction}.txf`,
        "text/plain"
      );
      toast.success("TurboTax file downloaded", {
        description: `${selectedYear} ${jurisdiction} report saved as .txf.`,
      });
      return;
    }

    if (kind === "taxact") {
      const csv = formatForTaxAct(currentReport);
      triggerDownload(
        csv,
        `taxact-${selectedYear}-${jurisdiction}.csv`,
        "text/csv"
      );
      toast.success("TaxAct file downloaded", {
        description: `${selectedYear} ${jurisdiction} report saved as CSV.`,
      });
      return;
    }

    if (kind === "multi-csv") {
      const sortedYears = [...selectedYears].sort((a, b) => b - a);
      const csv = exportMultiYearCsv(multiYearRows, jurisdiction);
      triggerDownload(
        csv,
        `tax-comparison-${sortedYears.join("-")}-${jurisdiction}.csv`,
        "text/csv"
      );
      toast.success("Multi-year comparison downloaded", {
        description: `${sortedYears.join(", ")} ${jurisdiction} comparison saved as CSV.`,
      });
    }
  }

  // The print stylesheet reads the data-print-* attributes on the report
  // section, which are derived from `pdfOptions`.
  function printPdf() {
    if (typeof window.print !== "function") {
      throw new Error("Printing is not supported in this browser.");
    }
    window.print();
  }

  async function generatePdf() {
    // Yield so the dialog's "generating" state paints before the print dialog blocks
    await new Promise((resolve) => setTimeout(resolve, 0));
    printPdf();
    setLastExport("pdf");
    setExportState("ready");
    toast.success("PDF ready", {
      description: `Choose "Save as PDF" in the print dialog to save your ${selectedYear} ${jurisdiction} report.`,
    });
  }

  const printDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section
      className="space-y-6"
      aria-label="Tax Reporting Tool"
      data-print-report
      data-print-title={
        pdfOptions.customTitle.trim() || `StellarSwipe Tax Report ${selectedYear} — ${jurisdiction}`
      }
      data-print-branding={pdfOptions.branding}
      data-print-orientation={pdfOptions.orientation}
      data-print-sections={[
        pdfOptions.includeSummary && "summary",
        pdfOptions.includeRates && "rates",
        pdfOptions.includeTransactions && "transactions",
      ]
        .filter(Boolean)
        .join(" ")}
      data-print-subtitle={`Generated ${printDate}`}
      data-print-date={printDate}
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">
            Tax Report Generator
          </h2>
        </div>
        <p className="text-sm text-foreground-muted">
          Generate tax documents based on your trading activity for the selected
          year and jurisdiction.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4 flex flex-wrap gap-4 items-end">
          {/* Jurisdiction */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label
              htmlFor="jurisdiction-select"
              className="text-xs font-medium text-foreground-muted flex items-center gap-1"
            >
              <Globe size={11} aria-hidden="true" />
              Tax Jurisdiction
            </label>
            <select
              id="jurisdiction-select"
              value={jurisdiction}
              onChange={(e) =>
                setJurisdiction(e.target.value as TaxJurisdiction)
              }
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Select tax jurisdiction"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {TAX_RATES[j].label} ({j})
                </option>
              ))}
            </select>
          </div>

          {/* Tax year (single-year mode only) */}
          {!multiYearMode && (
            <div className="flex flex-col gap-1.5 min-w-[120px]">
              <label
                htmlFor="year-select"
                className="text-xs font-medium text-foreground-muted flex items-center gap-1"
              >
                <BarChart2 size={11} aria-hidden="true" />
                Tax Year
              </label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Select tax year"
              >
                {yearSummaries.map((summary) => (
                  <option key={summary.year} value={summary.year}>
                    {yearOptionLabel(summary)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tax rate info */}
          <div className="flex flex-col gap-1.5 justify-end">
            <p className="text-xs text-foreground-muted">
              Short-term rate:{" "}
              <span className="font-semibold text-foreground">
                {(rates.shortTerm * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-xs text-foreground-muted">
              Long-term rate:{" "}
              <span className="font-semibold text-foreground">
                {(rates.longTerm * 100).toFixed(1)}%
              </span>
            </p>
          </div>

          {/* Multi-year toggle */}
          <div className="flex flex-col gap-1.5 justify-end ml-auto">
            <Button
              size="sm"
              variant={multiYearMode ? "default" : "outline"}
              onClick={() => setMultiYearMode((v) => !v)}
              className="gap-1.5"
              aria-pressed={multiYearMode}
              aria-label={
                multiYearMode
                  ? "Switch to single-year view"
                  : "Switch to multi-year comparison view"
              }
            >
              <Layers size={13} aria-hidden="true" />
              {multiYearMode ? "Single Year" : "Compare Years"}
              {multiYearMode ? (
                <ChevronUp size={12} aria-hidden="true" />
              ) : (
                <ChevronDown size={12} aria-hidden="true" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── MULTI-YEAR MODE ────────────────────────────────────────────────── */}
      {multiYearMode && (
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers size={14} className="text-blue-400" aria-hidden="true" />
              Multi-Year Comparison
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              Select the years you want to compare. All years use the{" "}
              {TAX_RATES[jurisdiction].label} ({jurisdiction}) rates.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {/* Year picker checkboxes */}
            <fieldset>
              <legend className="sr-only">Select years to compare</legend>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Years to compare"
              >
                {AVAILABLE_YEARS.map((y) => {
                  const checked = selectedYears.includes(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => toggleYear(y)}
                      aria-pressed={checked}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                        checked
                          ? "bg-blue-500/20 border-blue-500/60 text-blue-300"
                          : "bg-background border-border text-foreground-muted hover:bg-surface-high/40"
                      )}
                    >
                      {y}
                      {y === CURRENT_YEAR && (
                        <span className="ml-1 text-[10px] text-blue-400">
                          (current)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Comparison table */}
            <MultiYearComparisonTable rows={multiYearRows} />

            {/* Multi-year export */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <span className="text-xs text-foreground-muted">Export comparison:</span>
              <Button
                size="sm"
                variant="outline"
                disabled={isGenerating}
                onClick={() => setPendingExport("multi-csv")}
                className="gap-1.5"
                aria-label={`Export multi-year comparison for ${selectedYears
                  .sort((a, b) => b - a)
                  .join(", ")} as CSV`}
              >
                <Download size={13} aria-hidden="true" />
                CSV ({selectedYears.sort((a, b) => b - a).join(", ")})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SINGLE-YEAR SUMMARY CARDS ──────────────────────────────────────── */}
      {!multiYearMode && (
        <>
          <TaxYearDataNotice year={selectedYear} count={yearTransactions.length} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard
              label="Net Gain/Loss"
              value={`${isGain ? "+" : ""}$${Math.abs(netGainLoss).toFixed(2)}`}
              icon={isGain ? TrendingUp : TrendingDown}
              className={isGain ? "text-green-400" : "text-red-400"}
            />
            <SummaryCard
              label="Short-Term Gains"
              value={`$${currentReport.shortTermGains.toFixed(2)}`}
              sub={`Losses: $${currentReport.shortTermLosses.toFixed(2)}`}
              icon={TrendingUp}
              className="text-amber-400"
            />
            <SummaryCard
              label="Long-Term Gains"
              value={`$${currentReport.longTermGains.toFixed(2)}`}
              sub={`Losses: $${currentReport.longTermLosses.toFixed(2)}`}
              icon={TrendingUp}
              className="text-sky-400"
            />
            <SummaryCard
              label="Total Fees"
              value={`$${currentReport.totalFees.toFixed(4)}`}
              icon={Receipt}
              className="text-violet-400"
            />
            <SummaryCard
              label="Est. Tax Liability"
              value={`$${currentReport.estimatedTaxLiability.toFixed(2)}`}
              sub={rates.label}
              icon={DollarSign}
              className="text-orange-400"
            />
          </div>

          {/* Year-over-year comparison */}
          {yoyChange !== null && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-foreground">
                  Year-over-Year Comparison ({selectedYear - 1} →{" "}
                  {selectedYear})
                </h3>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-foreground-muted">
                      {selectedYear - 1} Net Gain/Loss
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        previousReport.totalGainLoss >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {previousReport.totalGainLoss >= 0 ? "+" : ""}$
                      {Math.abs(previousReport.totalGainLoss).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-foreground-muted">
                      {selectedYear} Net Gain/Loss
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        currentReport.totalGainLoss >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      )}
                    >
                      {currentReport.totalGainLoss >= 0 ? "+" : ""}$
                      {Math.abs(currentReport.totalGainLoss).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-foreground-muted">
                      Change
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        yoyChange >= 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {yoyChange >= 0 ? "+" : ""}
                      {yoyChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <TaxCategorySummary
            report={currentReport}
            transactionsById={transactionsById}
            assignments={categoryAssignments}
          />

          <TaxReviewQueue
            transactions={yearTransactions}
            assignments={categoryAssignments}
            onAssign={(id, assignment) =>
              setCategoryAssignments((prev) => assignCategory(prev, id, assignment))
            }
          />

          <TaxReconciliation transactions={transactions} />

          {/* Trade-level breakdown */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-foreground">
                Trade-Level Breakdown ({selectedYear})
              </h3>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {currentReport.entries.length === 0 ? (
                <p className="text-sm text-foreground-muted text-center py-6">
                  No taxable trades found for {selectedYear}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-xs"
                    aria-label={`Trade breakdown for ${selectedYear}`}
                  >
                    <thead>
                      <tr className="border-b border-border text-foreground-muted">
                        <th className="pb-2 text-left font-medium pr-4">
                          Date
                        </th>
                        <th className="pb-2 text-left font-medium pr-4">
                          Pair
                        </th>
                        <th className="pb-2 text-right font-medium pr-4">
                          Proceeds
                        </th>
                        <th className="pb-2 text-right font-medium pr-4">
                          Cost Basis
                        </th>
                        <th className="pb-2 text-right font-medium pr-4">
                          Gain/Loss
                        </th>
                        <th className="pb-2 text-right font-medium pr-4">
                          Fees
                        </th>
                        <th className="pb-2 text-left font-medium pr-4">
                          Term
                        </th>
                        <th className="pb-2 text-left font-medium pr-4">FX</th>
                        <th className="pb-2 text-left font-medium">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentReport.entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2 pr-4 text-foreground-muted">
                            {entry.date.toISOString().split("T")[0]}
                          </td>
                          <td className="py-2 pr-4 font-mono font-medium text-foreground">
                            {entry.assetPair}
                          </td>
                          <td className="py-2 pr-4 text-right text-foreground">
                            ${entry.proceeds.toFixed(2)}
                          </td>
                          <td className="py-2 pr-4 text-right text-foreground">
                            ${entry.costBasis.toFixed(2)}
                          </td>
                          <td
                            className={cn(
                              "py-2 pr-4 text-right font-medium",
                              entry.gainLoss >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            )}
                          >
                            {entry.gainLoss >= 0 ? "+" : ""}$
                            {entry.gainLoss.toFixed(2)}
                          </td>
                          <td className="py-2 pr-4 text-right text-foreground-muted">
                            ${entry.fees.toFixed(4)}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                entry.isLongTerm
                                  ? "bg-sky-500/15 text-sky-400"
                                  : "bg-amber-500/15 text-amber-400"
                              )}
                            >
                              {entry.isLongTerm ? "Long" : "Short"}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-foreground-muted font-mono">
                            {entry.foreignCurrency
                              ? `${entry.foreignCurrency} @${entry.conversionRate?.toFixed(4)}`
                              : "—"}
                          </td>
                          <td className="py-2 text-foreground-muted">
                            {(() => {
                              const tx = transactionsById.get(entry.id);
                              const category = tx
                                ? resolveCategory(tx, categoryAssignments)
                                : null;
                              return category ? (
                                TAX_CATEGORY_LABELS[category]
                              ) : (
                                <span className="text-amber-400">Uncategorized</span>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <TaxConversionRateDetails entries={currentReport.entries} />
          <TaxLineItemSources entries={currentReport.entries} transactionsById={transactionsById} />

          {/* Export section */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-foreground">
                Export Report
              </h3>
              <p className="text-xs text-foreground-muted">
                Download your {selectedYear} {jurisdiction} tax report in your
                preferred format.
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="csv-preset-select"
                    className="text-xs font-medium text-foreground-muted"
                  >
                    CSV Format
                  </label>
                  <select
                    id="csv-preset-select"
                    value={csvPreset}
                    onChange={(e) => setCsvPreset(e.target.value as CsvPreset)}
                    className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Select CSV export format"
                  >
                    {(Object.keys(CSV_PRESETS) as CsvPreset[]).map((key) => (
                      <option key={key} value={key}>
                        {CSV_PRESETS[key].label}
                      </option>
                    ))}
                  </select>
                </div>
                <TaxFormatPreview
                  report={currentReport}
                  preset={csvPreset}
                  options={formatOptions}
                  onChange={setFormatOptions}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => setPendingExport("csv")}
                    className="gap-1.5"
                    aria-label={`Export ${selectedYear} ${jurisdiction} tax report as CSV`}
                  >
                    <Download size={13} aria-hidden="true" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => setPdfPreviewOpen(true)}
                    className="gap-1.5"
                    aria-label={`Export ${selectedYear} ${jurisdiction} tax report as PDF`}
                  >
                    <Download size={13} aria-hidden="true" />
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => setPendingExport("turbotax")}
                    className="gap-1.5"
                    aria-label={`Export ${selectedYear} ${jurisdiction} tax report for TurboTax`}
                  >
                    <Download size={13} aria-hidden="true" />
                    TurboTax (.txf)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => setPendingExport("taxact")}
                    className="gap-1.5"
                    aria-label={`Export ${selectedYear} ${jurisdiction} tax report for TaxAct`}
                  >
                    <Download size={13} aria-hidden="true" />
                    TaxAct (.csv)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Disclaimer */}
      <div
        role="note"
        aria-label="Tax disclaimer"
        className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
      >
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0 text-amber-400"
          aria-hidden="true"
        />
        <p className="text-foreground-muted leading-relaxed">
          <span className="font-medium text-amber-400">Disclaimer: </span>
          The information provided by this tool is for informational purposes
          only and does not constitute tax, legal, or financial advice. Tax laws
          vary by jurisdiction and individual circumstances. The estimated tax
          liability shown is a preliminary estimate only. Please consult a
          qualified tax professional before filing your taxes.
        </p>
      </div>

      {exportState !== "idle" && lastExport && (
        <div
          role={exportState === "failed" ? "alert" : "status"}
          aria-live={exportState === "failed" ? "assertive" : "polite"}
          aria-busy={isGenerating}
          data-testid="tax-export-status"
          className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${
            exportState === "failed"
              ? "border-red-500/30 bg-red-500/5 text-red-400"
              : "border-border bg-foreground/5 text-foreground"
          }`}
        >
          <span>
            {exportState === "generating" &&
              `Generating your ${exportPreviewConfig[lastExport].title.replace(/^Export /, "")}…`}
            {exportState === "ready" &&
              `Ready: ${exportPreviewConfig[lastExport].title.replace(/^Export /, "")} has been downloaded.`}
            {exportState === "failed" &&
              "Report generation failed. Your selected options are unchanged."}
          </span>
          {exportState === "failed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                startExport(lastExport).catch(() => setExportState("failed"))
              }
            >
              Retry
            </Button>
          )}
        </div>
      )}

      <PdfReportPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        report={currentReport}
        options={pdfOptions}
        onOptionsChange={setPdfOptions}
        filters={[
          { label: "Tax year", value: String(selectedYear) },
          { label: "Jurisdiction", value: `${rates.label} (${jurisdiction})` },
        ]}
        onEditFilters={() => {
          setPdfPreviewOpen(false);
          // Wait for the dialog to release focus before moving it to the filters
          setTimeout(() => document.getElementById("jurisdiction-select")?.focus(), 0);
        }}
        onGenerate={generatePdf}
      />

      {pendingExport && (
        <ExportPreviewDialog
          open={pendingExport !== null}
          onOpenChange={(open) => {
            if (!open) setPendingExport(null);
          }}
          title={exportPreviewConfig[pendingExport].title}
          description={exportPreviewConfig[pendingExport].description}
          items={
            exportValidation
              ? [
                  { label: "Period", value: exportValidation.period.label },
                  {
                    label: "Transactions",
                    value: String(exportValidation.transactionCount),
                  },
                  ...exportPreviewConfig[pendingExport].items,
                ]
              : exportPreviewConfig[pendingExport].items
          }
          warnings={exportValidation?.warnings}
          blockingErrors={exportValidation?.errors}
          cancelLabel="Back to review"
          confirmLabel={exportPreviewConfig[pendingExport].confirmLabel}
          onConfirm={() => startExport(pendingExport)}
        />
      )}
    </section>
  );
}
