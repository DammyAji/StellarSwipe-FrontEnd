"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import Papa from "papaparse";
import { z } from "zod";
import {
  CSV_COLUMNS,
  journalEntrySchema,
  type JournalEntry,
  type CSVColumn,
} from "@/lib/journalSchema";
import { useTransactionStore } from "@/store/useTransactionStore";
import {
  saveCSVImportDraft,
  loadCSVImportDraft,
  clearCSVImportDraft,
  fileMatchesDraft,
  loadSavedMappings,
  saveMapping,
  updateSavedMapping,
  deleteSavedMapping,
  findMissingColumns,
  saveCSVImportSession,
  loadCSVImportSession,
  clearCSVImportSession,
  toRowErrors,
  csvCellId,
  type CSVImportDraft,
  type CSVRowError,
  type SavedCSVColumnMapping,
} from "@/lib/csvImportDraft";
import { DuplicateResolutionStep, type DuplicateGroup, type DuplicateResolution } from "@/components/DuplicateResolutionStep";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "upload" | "mapping" | "preview" | "duplicates" | "summary";

interface ValidationResult {
  row: Record<string, any>;
  /** 1-based row number in the uploaded file (header excluded). */
  rowNumber: number;
  data?: JournalEntry;
  errors?: string[];
  // #1066 — per-field validation failures for direct navigation
  fieldErrors?: CSVRowError[];
  isValid: boolean;
}

const REQUIRED_COLUMNS: CSVColumn[] = ["Date", "Asset Pair", "Amount", "Price", "Token"];

// #1069 — preview table keyboard navigation
const PREVIEW_ROW_LIMIT = 50;
const PREVIEW_COLUMNS = ["Status", "Date", "Pair", "Amount", "Action"] as const;
const PREVIEW_COLUMN_COUNT = PREVIEW_COLUMNS.length;

function previewCellId(row: number, col: number) {
  return `csv-preview-cell-${row}-${col}`;
}

function previewRowErrorId(row: number) {
  return `csv-preview-row-${row}-errors`;
}

/**
 * #1066 — inline editor for an invalid cell. Commits on blur or Enter so the
 * row is re-validated and the preview summary updates immediately.
 */
function EditableCell({
  value,
  label,
  onCommit,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (draft !== value) onCommit(draft);
        }
      }}
      className="w-full rounded-md border border-red-400/30 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-red-400"
    />
  );
}
}

export function CSVImportModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<CSVColumn, string>>({} as any);
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState({
    imported: 0,
    skipped: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
  });
  const [resumableDraft, setResumableDraft] = useState<CSVImportDraft | null>(
    null
  );
  // #780 — duplicate resolution state
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateResolutions, setDuplicateResolutions] = useState<
    Record<string, DuplicateResolution>
  >({});
  // #1067 — rows the user excluded individually, keyed by duplicate group
  const [excludedDuplicateRows, setExcludedDuplicateRows] = useState<
    Record<string, number[]>
  >({});
  // #1065 — saved named column mappings
  const [savedMappings, setSavedMappings] = useState<SavedCSVColumnMapping[]>(
    []
  );
  const [mappingName, setMappingName] = useState("");
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<CSVColumn[]>([]);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  // #1068 — whether the current state was restored from the in-session snapshot
  const [restoredFromSession, setRestoredFromSession] = useState(false);
  // #1066 — cell the user navigated to from the error list
  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number;
    field: CSVColumn;
  } | null>(null);

  const bulkAddTransactions = useTransactionStore(
    (state) => state.bulkAddTransactions
  );

  // #1069 — roving tabindex grid state for the preview table
  const previewTableRef = useRef<HTMLTableElement | null>(null);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [announcement, setAnnouncement] = useState("");

  const previewRowCount = Math.min(validationResults.length, PREVIEW_ROW_LIMIT);

  const focusCell = useCallback((row: number, col: number) => {
    const nextRow = Math.max(0, Math.min(row, previewRowCount - 1));
    const nextCol = Math.max(0, Math.min(col, PREVIEW_COLUMN_COUNT - 1));
    setActiveCell({ row: nextRow, col: nextCol });
    const cell = previewTableRef.current?.querySelector<HTMLElement>(
      `[data-preview-cell="${nextRow}-${nextCol}"]`
    );
    cell?.focus();
    setAnnouncement(
      `Row ${nextRow + 1} of ${previewRowCount}, column ${nextCol + 1} of ${PREVIEW_COLUMN_COUNT}: ${PREVIEW_COLUMNS[nextCol]}`
    );
  }, [previewRowCount]);

  const handlePreviewKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTableElement>) => {
      const target = event.target as HTMLElement | null;
      const cell = target?.closest<HTMLElement>("[data-preview-cell]");
      if (!cell) return;
      const [row, col] = cell.dataset.previewCell!.split("-").map(Number);
      let nextRow = row;
      let nextCol = col;

      switch (event.key) {
        case "ArrowRight":
          nextCol = col + 1;
          break;
        case "ArrowLeft":
          nextCol = col - 1;
          break;
        case "ArrowDown":
          nextRow = row + 1;
          break;
        case "ArrowUp":
          nextRow = row - 1;
          break;
        case "Home":
          nextCol = event.ctrlKey ? 0 : col;
          nextRow = event.ctrlKey ? 0 : row;
          break;
        case "End":
          nextCol = event.ctrlKey ? PREVIEW_COLUMN_COUNT - 1 : col;
          nextRow = event.ctrlKey ? previewRowCount - 1 : row;
          break;
        case "PageDown":
          nextRow = row + 10;
          break;
        case "PageUp":
          nextRow = row - 10;
          break;
        default:
          return;
      }

      event.preventDefault();
      focusCell(nextRow, nextCol);
    },
    [focusCell, previewRowCount]
  );

  // Reset in-memory component state only — the persisted draft (if any)
  // survives so the modal can offer to resume next time it's opened.
  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({} as any);
    setValidationResults([]);
    setSummary({ imported: 0, skipped: 0, skippedDuplicates: 0, skippedInvalid: 0 });
    setDuplicateGroups([]);
    setDuplicateResolutions({});
    setExcludedDuplicateRows({});
    setMappingName("");
    setActiveMappingId(null);
    setMissingColumns([]);
    setEditingMappingId(null);
    setEditingName("");
    setRestoredFromSession(false);
    setFocusedCell(null);
    setActiveCell({ row: 0, col: 0 });
    setAnnouncement("");
  }, []);

  // Load saved mappings each time the modal opens.
  useEffect(() => {
    if (open) {
      setSavedMappings(loadSavedMappings());
    }
  }, [open]);

  const applySavedMapping = useCallback(
    (saved: SavedCSVColumnMapping) => {
      setMapping({ ...saved.mapping } as Record<CSVColumn, string>);
      setActiveMappingId(saved.id);
      setMappingName(saved.name);
      setMissingColumns(findMissingColumns(saved, headers));
    },
    [headers]
  );

  const handleSaveMapping = useCallback(() => {
    const name = mappingName.trim();
    if (!name) {
      toast.error("Give the mapping a name first");
      return;
    }
    const saved = activeMappingId
      ? updateSavedMapping(activeMappingId, { name, mapping })
      : saveMapping(name, mapping);
    if (!saved) {
      toast.error("Could not save mapping");
      return;
    }
    setSavedMappings(loadSavedMappings());
    setActiveMappingId(saved.id);
    setMappingName(saved.name);
    toast.success(`Saved mapping "${saved.name}"`);
  }, [activeMappingId, mapping, mappingName]);

  const handleRenameMapping = useCallback(
    (id: string) => {
      const name = editingName.trim();
      if (!name) return;
      updateSavedMapping(id, { name });
      setSavedMappings(loadSavedMappings());
      setEditingMappingId(null);
      setEditingName("");
    },
    [editingName]
  );

  const handleDeleteMapping = useCallback(
    (id: string) => {
      deleteSavedMapping(id);
      setSavedMappings(loadSavedMappings());
      if (activeMappingId === id) {
        setActiveMappingId(null);
        setMappingName("");
        setMissingColumns([]);
      }
    },
    [activeMappingId]
  );

  // Look for a resumable draft each time the modal opens.
  useEffect(() => {
    if (open) {
      setResumableDraft(loadCSVImportDraft());
    }
  }, [open]);

  // #1068 — restore the in-session file + preview when the dialog is reopened.
  // Only mapping/preview states are restorable; completed (summary) or
  // canceled imports are never snapshotted, so they cannot be replayed.
  useEffect(() => {
    if (!open) return;
    const session = loadCSVImportSession();
    if (!session) return;
    setFile(session.file);
    setCsvData(session.csvData);
    setHeaders(session.headers);
    setMapping(session.mapping as Record<CSVColumn, string>);
    setValidationResults(session.validationResults as ValidationResult[]);
    setDuplicateGroups(session.duplicateGroups as DuplicateGroup[]);
    setDuplicateResolutions(
      session.duplicateResolutions as Record<string, DuplicateResolution>
    );
    setExcludedDuplicateRows(session.excludedDuplicateRows);
    setStep(session.step);
    setRestoredFromSession(true);
  }, [open]);

  // #1068 — keep the in-session snapshot in sync while the import is in
  // progress; drop it once the import completes or is canceled.
  useEffect(() => {
    if (!open) return;
    if (!file || (step !== "mapping" && step !== "preview")) {
      clearCSVImportSession();
      return;
    }
    saveCSVImportSession({
      file,
      csvData,
      headers,
      mapping,
      step,
      validationResults,
      duplicateGroups,
      duplicateResolutions,
      excludedDuplicateRows,
    });
  }, [
    open,
    file,
    csvData,
    headers,
    mapping,
    step,
    validationResults,
    duplicateGroups,
    duplicateResolutions,
    excludedDuplicateRows,
  ]);

  // Persist mapping/step progress as the user works — never the raw CSV
  // rows or file contents, only metadata needed to relink a re-selected file.
  useEffect(() => {
    if (!file || (step !== "mapping" && step !== "preview")) return;
    const validRows = validationResults.filter((r) => r.isValid).length;
    saveCSVImportDraft({
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      headers,
      mapping,
      step,
      rowCount: csvData.length,
      validSummary:
        step === "preview"
          ? { valid: validRows, invalid: validationResults.length - validRows }
          : undefined,
    });
  }, [file, headers, mapping, step, csvData.length, validationResults]);

  const discardDraft = useCallback(() => {
    clearCSVImportDraft();
    setResumableDraft(null);
  }, []);

  // #1068 — explicit discard of the restored in-session import.
  const discardSession = useCallback(() => {
    clearCSVImportSession();
    reset();
  }, [reset]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as any[]).filter(
          (row) =>
            row &&
            typeof row === "object" &&
            Object.values(row).some(
              (value) => value !== null && String(value).trim() !== ""
            )
        );

        if (rows.length === 0) {
          toast.error(
            "This file is empty or is not a valid CSV. Please upload a CSV file with a header row and at least one entry."
          );
          return;
        }

        setCsvData(rows);
        if (results.meta.fields) {
          setHeaders(results.meta.fields);

          // Resume a saved draft's mapping if this is the same file.
          const draft = resumableDraft;
          const isSameFileAsDraft =
            draft && fileMatchesDraft(selectedFile, draft);

          const newMapping: any = isSameFileAsDraft ? { ...draft!.mapping } : {};
          CSV_COLUMNS.forEach((col) => {
            if (newMapping[col]) return; // keep restored mapping
            const match = results.meta.fields?.find(
              (f) =>
                f.toLowerCase() === col.toLowerCase() ||
                f.toLowerCase().replace(/ /g, "") ===
                  col.toLowerCase().replace(/ /g, "")
            );
            if (match) newMapping[col] = match;
          });
          setMapping(newMapping);
          setStep("mapping");
          setRestoredFromSession(false);

          // #1065 — check the new file against the active saved mapping.
          const active = savedMappings.find((m) => m.id === activeMappingId);
          if (active) {
            const missing = findMissingColumns(active, results.meta.fields ?? []);
            setMissingColumns(missing);
            if (missing.length) {
              toast.warning(
                `Saved mapping "${active.name}" is missing columns: ${missing.join(", ")}`
              );
            }
          } else {
            setMissingColumns([]);
          }

          if (isSameFileAsDraft) {
            toast.success("Restored your previous import progress");
          }
          setResumableDraft(null);
        }
      },
      error: (err) => {
        toast.error(`Error parsing CSV: ${err.message}`);
      },
    });
  };

  const validateRows = useCallback(async () => {
    setIsProcessing(true);
    const results: ValidationResult[] = [];

    // Process in chunks to keep UI responsive
    const chunkSize = 100;
    for (let i = 0; i < csvData.length; i += chunkSize) {
      const chunk = csvData.slice(i, i + chunkSize);

      const chunkResults = chunk.map((row, index) => {
        const rowNumber = i + index + 1;
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([target, source]) => {
          if (source)
            mappedRow[target.toLowerCase().replace(" ", "")] = row[source];
        });

        // Special handling for date and default values
        const validationData = {
          ...mappedRow,
          type: mappedRow.type || "MANUAL",
          status: mappedRow.status || "SUCCEEDED",
          outcome: mappedRow.outcome || "PENDING",
          fee: mappedRow.fee || "0",
        };

        const parsed = journalEntrySchema.safeParse(validationData);
        return {
          row,
          rowNumber,
          data: parsed.success ? parsed.data : undefined,
          errors: !parsed.success
            ? parsed.error.issues.map((msg) => msg.message)
            : undefined,
          fieldErrors: !parsed.success
            ? toRowErrors(parsed.error.issues)
            : undefined,
          isValid: parsed.success,
        };
      });

      results.push(...chunkResults);
      // Brief pause for UI thread
      await new Promise((r) => setTimeout(r, 0));
    }

    setValidationResults(results);
    setFocusedCell(null);
    setIsProcessing(false);

    // ── Duplicate detection (#780) ─────────────────────────────────────
    // Build a fingerprint for each valid row: date + assetPair.
    // Group rows that share the same fingerprint to surface them as
    // duplicates the user should resolve before committing.
    const fingerprintCounts: Record<string, number> = {};
    const fingerprintRows: Record<string, number[]> = {};
    results.forEach((r, index) => {
      if (!r.isValid || !r.data) return;
      const key = `${r.data.date}__${r.data.assetPair}`;
      fingerprintCounts[key] = (fingerprintCounts[key] ?? 0) + 1;
      (fingerprintRows[key] ??= []).push(index);
    });

    const detectedGroups: DuplicateGroup[] = Object.entries(fingerprintCounts)
      .filter(([, count]) => count > 1)
      .map(([key, count]) => {
        const [date, pair] = key.split("__");
        return {
          key,
          description: `${pair} — ${date}`,
          incomingCount: count,
          existingCount: 0, // could cross-check against store; 0 for now
          // #1067 — surface the fields that caused the match
          matchedFields: [
            { field: "Date", value: date },
            { field: "Asset Pair", value: pair },
          ],
          rowIndices: fingerprintRows[key] ?? [],
        };
      });

    setDuplicateGroups(detectedGroups);
    setExcludedDuplicateRows({});

    // Seed resolutions with the default ("skip") for each detected group.
    const seedResolutions: Record<string, DuplicateResolution> = {};
    detectedGroups.forEach((g) => {
      seedResolutions[g.key] = "skip";
    });
    setDuplicateResolutions(seedResolutions);

    // Route to duplicates step if any were found, otherwise go straight to preview.
    setStep(detectedGroups.length > 0 ? "duplicates" : "preview");
    setRestoredFromSession(false);
  }, [csvData, mapping]);

  const handleImport = () => {
    const validRows = validationResults.filter((r) => r.isValid && r.data);

    // Apply duplicate resolutions (#780) and per-row exclusions (#1067):
    // exclude rows whose fingerprint maps to "skip" or that the user excluded.
    const acceptedRows = validRows.filter((r) => {
      if (!r.data) return false;
      const key = `${r.data.date}__${r.data.assetPair}`;
      const resolution = duplicateResolutions[key];
      // If the row belongs to a duplicate group with resolution "skip", exclude it.
      if (resolution === "skip" && duplicateGroups.some((g) => g.key === key)) {
        return false;
      }
      // Rows the user explicitly excluded in the duplicate review step.
      const rowIndex = validationResults.indexOf(r);
      if ((excludedDuplicateRows[key] ?? []).includes(rowIndex)) return false;
      return true;
    });

    const transactions = acceptedRows.map((r) => ({
      id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      hash: `csv-${Date.now().toString(16)}`,
      assetPair: r.data!.assetPair,
      amount: r.data!.amount,
      price: r.data!.price,
      fee: r.data!.fee,
      token: r.data!.token,
      timestamp: new Date(r.data!.date).getTime(),
      type: r.data!.type,
      status: r.data!.status,
      outcome: r.data!.outcome,
    }));

    bulkAddTransactions(transactions);
    const skippedInvalid = validationResults.length - validRows.length;
    const skippedDuplicates = validRows.length - acceptedRows.length;
    setSummary({
      imported: transactions.length,
      skipped: skippedInvalid + skippedDuplicates,
      skippedDuplicates,
      skippedInvalid,
    });
    setStep("summary");
    clearCSVImportDraft();
    clearCSVImportSession();
  };

  // #1066 — every invalid row with its field + reason, for direct navigation.
  const rowErrorList = useMemo(
    () =>
      validationResults.flatMap((res, rowIndex) =>
        res.isValid
          ? []
          : (res.fieldErrors ?? []).map((err) => ({ rowIndex, ...err }))
      ),
    [validationResults]
  );

  const focusCell = useCallback((rowIndex: number, field: CSVColumn) => {
    setFocusedCell({ rowIndex, field });
    if (typeof document === "undefined") return;
    const el = document.getElementById(csvCellId(rowIndex, field));
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    (el as HTMLElement | null)?.focus?.();
  }, []);

  // #1066 — correct a cell in place and re-validate only that row, so the
  // summary updates while every other (valid) row is preserved.
  const updateCell = useCallback(
    (rowIndex: number, field: CSVColumn, value: string) => {
      const source = mapping[field];
      if (!source) return;
      const nextRow = { ...csvData[rowIndex], [source]: value };
      setCsvData((prev) =>
        prev.map((row, i) => (i === rowIndex ? nextRow : row))
      );

      const mappedRow: any = {};
      Object.entries(mapping).forEach(([target, src]) => {
        if (src) mappedRow[target.toLowerCase().replace(" ", "")] = nextRow[src];
      });
      const validationData = {
        ...mappedRow,
        type: mappedRow.type || "MANUAL",
        status: mappedRow.status || "SUCCEEDED",
        outcome: mappedRow.outcome || "PENDING",
        fee: mappedRow.fee || "0",
      };
      const parsed = journalEntrySchema.safeParse(validationData);
      setValidationResults((prev) =>
        prev.map((res, i) =>
          i === rowIndex
            ? {
                row: nextRow,
                data: parsed.success ? parsed.data : undefined,
                errors: parsed.success
                  ? undefined
                  : parsed.error.issues.map((msg) => msg.message),
                fieldErrors: parsed.success
                  ? undefined
                  : toRowErrors(parsed.error.issues),
                isValid: parsed.success,
              }
            : res
        )
      );
    },
    [csvData, mapping]
  );

  const mappingIssues = useMemo(() => {
    const issues: string[] = [];
    const missing = REQUIRED_COLUMNS.filter((col) => !mapping[col]);
    if (missing.length) issues.push(`Missing required mappings: ${missing.join(", ")}.`);
    const missingHeaders = REQUIRED_COLUMNS.filter(
      (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase())
    );
    if (missingHeaders.length)
      issues.push(
        `Missing required columns: ${missingHeaders.join(", ")}. Add these columns to your CSV and re-upload.`
      );
    const selected = Object.values(mapping).filter(Boolean);
    const duplicates = [...new Set(selected.filter((source, index) => selected.indexOf(source) !== index))];
    if (duplicates.length) issues.push(`Duplicate source columns: ${duplicates.join(", ")}. Choose each source only once.`);
    const unsupported = Object.values(mapping).filter((source) => source && !headers.includes(source));
    if (unsupported.length) issues.push(`Unsupported source columns: ${unsupported.join(", ")}.`);
    if (missingColumns.length) issues.push(`Saved mapping is missing columns in this file: ${missingColumns.join(", ")}.`);
    return issues;
  }, [headers, mapping, missingColumns]);

  return (
    <Dialog
      open={open}
      onOpenChange={(val: boolean) => {
        setOpen(val);
        if (!val) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload size={16} /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl sm:max-h-[80vh] overflow-hidden flex flex-col p-0 bg-slate-950 border-white/10 text-white rounded-3xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="text-blue-400" />
            Bulk Import CSV
          </DialogTitle>
          {/* Stepper */}
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className={cn(step === "upload" && "text-blue-400")}>
              1. Upload
            </span>
            <ChevronRight size={12} />
            <span className={cn(step === "mapping" && "text-blue-400")}>
              2. Mapping
            </span>
            <ChevronRight size={12} />
            <span className={cn(step === "preview" && "text-blue-400")}>
              3. Preview
            </span>
            <ChevronRight size={12} />
            <span className={cn(step === "duplicates" && "text-blue-400")}>
              4. Duplicates
            </span>
            <ChevronRight size={12} />
            <span className={cn(step === "summary" && "text-blue-400")}>
              5. Summary
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "upload" && resumableDraft && !restoredFromSession && (
            <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-blue-200">
                  Resume unfinished import: {resumableDraft.fileName}
                </p>
                <p className="text-xs text-blue-300/80">
                  {resumableDraft.rowCount} rows mapped
                  {resumableDraft.validSummary
                    ? ` · ${resumableDraft.validSummary.valid} valid, ${resumableDraft.validSummary.invalid} with errors`
                    : ""}
                  . Re-select the same file to continue.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={discardDraft}
                className="shrink-0 text-blue-200 hover:text-white"
              >
                Discard draft
              </Button>
            </div>
          )}

          {restoredFromSession && step === "upload" && (
            <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-blue-200">
                  Restored your import: {file?.name}
                </p>
                <p className="text-xs text-blue-300/80">
                  {csvData.length} rows loaded. Nothing has been imported yet.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={discardSession}
                className="shrink-0 text-blue-200 hover:text-white"
              >
                Discard import
              </Button>
            </div>
          )}

          {restoredFromSession && step !== "upload" && step !== "summary" && (
            <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-blue-200">
                  Restored your import preview: {file?.name}
                </p>
                <p className="text-xs text-blue-300/80">
                  {validationResults.length} rows checked
                  {validationResults.length
                    ? ` · ${validationResults.filter((r) => r.isValid).length} valid, ${
                        validationResults.filter((r) => !r.isValid).length
                      } with errors`
                    : ""}
                  . Nothing has been imported yet.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={discardSession}
                className="shrink-0 text-blue-200 hover:text-white"
              >
                Discard import
              </Button>
            </div>
          )}

          {step === "upload" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl bg-white/5 p-12 text-center">
              <Upload className="h-12 w-12 text-slate-500 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                Select your trading history file
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                Upload a .csv file exported from your exchange or tracker.
                We&apos;ll help you map the columns.
              </p>
              <input
                type="file"
                id="csv-upload"
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-sm font-medium text-slate-200">
                  Saved mappings
                </p>
                {savedMappings.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No saved mappings yet. Map the columns below and save them
                    by name to reuse on later imports.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {savedMappings.map((saved) => (
                      <li
                        key={saved.id}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        {editingMappingId === saved.id ? (
                          <>
                            <input
                              aria-label={`Rename mapping ${saved.name}`}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRenameMapping(saved.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMappingId(null);
                                setEditingName("");
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-200">{saved.name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applySavedMapping(saved)}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMappingId(saved.id);
                                setEditingName(saved.name);
                              }}
                            >
                              Rename
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-300 hover:text-red-200"
                              onClick={() => handleDeleteMapping(saved.id)}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Mapping name"
                    placeholder="Mapping name"
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button size="sm" onClick={handleSaveMapping}>
                    {activeMappingId ? "Update mapping" : "Save mapping"}
                  </Button>
                </div>
                {missingColumns.length > 0 && (
                  <p
                    role="alert"
                    className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-200"
                  >
                    Missing columns in this file: {missingColumns.join(", ")}.
                    Re-map them below.
                  </p>
                )}
              </div>
              <p className="text-sm text-slate-400">
                Match your CSV headers to the corresponding journal fields.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CSV_COLUMNS.map((col) => (
                  <div key={col} className="space-y-1.5">
                    <label
                      htmlFor={`csv-column-map-${col}`}
                      className="text-xs font-medium text-slate-500 flex items-center justify-between"
                    >
                      {col}
                      {[
                        "Date",
                        "Asset Pair",
                        "Amount",
                        "Price",
                        "Token",
                      ].includes(col) && (
                        <span className="text-red-400 text-[10px] uppercase font-bold">
                          Required
                        </span>
                      )}
                    </label>
                    <select
                      id={`csv-column-map-${col}`}
                      value={mapping[col] || ""}
                      onChange={(e) => {
                        setMapping({ ...mapping, [col]: e.target.value });
                        setMissingColumns((prev) =>
                          prev.filter((c) => c !== col)
                        );
                      }}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select column...</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div role="status" aria-live="polite" className={cn("rounded-xl border p-3 text-sm", mappingIssues.length ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200")}>
                {mappingIssues.length ? mappingIssues.map((issue) => <p key={issue}>{issue}</p>) : "All columns are mapped and ready for preview."}
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Showing {validationResults.length} rows detected in your file.
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={12} />{" "}
                    {validationResults.filter((r) => r.isValid).length} Valid
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={12} />{" "}
                    {validationResults.filter((r) => !r.isValid).length} Error
                  </span>
                </div>
              </div>

              {/* #1066 — invalid rows with their field + reason; selecting one
                  focuses the affected cell so it can be corrected in place. */}
              {rowErrorList.length > 0 && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-3 text-xs">
                  <p className="mb-2 font-medium text-red-200">
                    {rowErrorList.length} validation{" "}
                    {rowErrorList.length === 1 ? "error" : "errors"} — select one
                    to jump to the cell.
                  </p>
                  <ul className="space-y-1">
                    {rowErrorList.slice(0, 50).map((err, i) => (
                      <li key={`${err.rowIndex}-${err.field}-${i}`}>
                        <button
                          type="button"
                          onClick={() => focusCell(err.rowIndex, err.field)}
                          aria-label={`Row ${err.rowIndex + 1}, ${err.field}: ${err.reason}. Focus cell.`}
                          className={cn(
                            "w-full rounded-lg px-2 py-1 text-left text-red-200 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-400",
                            focusedCell?.rowIndex === err.rowIndex &&
                              focusedCell?.field === err.field &&
                              "bg-red-500/15 ring-1 ring-red-400/40"
                          )}
                        >
                          <span className="font-medium">
                            Row {err.rowIndex + 1} · {err.field}
                          </span>
                          <span className="text-red-300/80"> — {err.reason}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p id="csv-preview-instructions" className="text-xs text-slate-500">
                Use the arrow keys to move between cells, Home/End to jump to the
                start or end of a row, and Ctrl+Home/Ctrl+End to jump to the first
                or last cell. Tab moves out of the table.
              </p>
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {announcement}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900 overflow-hidden text-xs">
                <table
                  ref={previewTableRef}
                  className="w-full text-left"
                  aria-label="CSV import preview"
                  aria-describedby="csv-preview-instructions"
                  aria-rowcount={previewRowCount + 1}
                  aria-colcount={PREVIEW_COLUMN_COUNT}
                  onKeyDown={handlePreviewKeyDown}
                >
                  <caption className="sr-only">
                    CSV import preview: {previewRowCount} of{" "}
                    {validationResults.length} rows, {PREVIEW_COLUMN_COUNT}{" "}
                    columns.
                  </caption>
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      {PREVIEW_COLUMNS.map((label, col) => (
                        <th
                          key={label}
                          id={`csv-preview-header-${col}`}
                          scope="col"
                          aria-colindex={col + 1}
                          className={cn(
                            "px-3 py-2",
                            label === "Action" && "text-right"
                          )}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {validationResults.slice(0, PREVIEW_ROW_LIMIT).map((res, i) => {
                      const rowNumber = i + 1;
                      const isActiveRow = activeCell.row === i;
                      const cellProps = (col: number) => ({
                        id: previewCellId(i, col),
                        "data-preview-cell": `${i}-${col}`,
                        tabIndex: isActiveRow && activeCell.col === col ? 0 : -1,
                        "aria-colindex": col + 1,
                        onFocus: () => setActiveCell({ row: i, col }),
                      });
                      return (
                        <tr
                          key={i}
                          aria-rowindex={rowNumber + 1}
                          aria-rowcount={previewRowCount + 1}
                          className={cn(!res.isValid && "bg-red-400/5")}
                        >
                          <td className="px-3 py-2">
                      });
                      return (
                        <tr
                          key={i}
                          aria-rowindex={rowNumber + 1}
                          aria-rowcount={previewRowCount + 1}
                          className={cn(!res.isValid && "bg-red-400/5")}
                        >
                          <td
                            {...cellProps(0)}
                            className="px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {res.isValid ? (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-400"
                                aria-hidden="true"
                              />
                            ) : (
                              <div className="group relative">
                                <AlertCircle
                                  size={14}
                                  className="text-red-400 cursor-help"
                                  aria-hidden="true"
                                />
                                <div className="absolute left-6 top-0 hidden group-hover:block z-10 w-48 rounded-lg bg-red-950 p-2 text-[10px] shadow-xl border border-red-400/20">
                                  <p className="font-semibold">Row {res.rowNumber}</p>
                                  {res.errors?.map((err, j) => (
                                    <p key={j}>• {err}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            <span className="sr-only">
                              {res.isValid
                                ? `Row ${rowNumber} is valid and will be imported.`
                                : `Row ${rowNumber} has validation errors and will be skipped.`}
                            </span>
                            {!res.isValid && res.errors?.length ? (
                              <ul
                                id={previewRowErrorId(i)}
                                className="sr-only"
                              >
                                {res.errors.map((err, j) => (
                                  <li key={j}>{err}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td
                            {...cellProps(1)}
                            aria-describedby={
                              !res.isValid && res.errors?.length
                                ? previewRowErrorId(i)
                                : undefined
                            }
                            className="px-3 py-2 text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {res.isValid
                              ? res.data?.date
                              : res.row[mapping["Date"] || ""] || "—"}
                          </td>
                          <td
                            {...cellProps(2)}
                            aria-describedby={
                              !res.isValid && res.errors?.length
                                ? previewRowErrorId(i)
                                : undefined
                            }
                            className="px-3 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {res.isValid
                              ? res.data?.assetPair
                              : res.row[mapping["Asset Pair"] || ""] || "—"}
                          </td>
                          <td
                            {...cellProps(3)}
                            aria-describedby={
                              !res.isValid && res.errors?.length
                                ? previewRowErrorId(i)
                                : undefined
                            }
                            className="px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {res.isValid
                              ? res.data?.amount
                              : res.row[mapping["Amount"] || ""] || "—"}
                          </td>
                          <td
                            {...cellProps(4)}
                            className="px-3 py-2 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            {res.isValid ? (
                              <span className="text-emerald-400 opacity-50">
                                Importing
                              </span>
                            ) : (
                              <span className="text-red-400 opacity-50">
                                Skipping
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {validationResults.length > PREVIEW_ROW_LIMIT && (
                      <tr>
                        <td
                          colSpan={PREVIEW_COLUMN_COUNT}
                          className="px-3 py-4 text-center text-slate-500"
                        >
                          + {validationResults.length - PREVIEW_ROW_LIMIT} more
                          rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Duplicates step (#780) ─────────────────────────────── */}
          {step === "duplicates" && (
            <DuplicateResolutionStep
              groups={duplicateGroups}
              resolutions={duplicateResolutions}
              onChange={(key, resolution) =>
                setDuplicateResolutions((prev) => ({ ...prev, [key]: resolution }))
              }
              excludedRows={excludedDuplicateRows}
              onToggleRow={(key, rowIndex, excluded) =>
                setExcludedDuplicateRows((prev) => {
                  const current = prev[key] ?? [];
                  return {
                    ...prev,
                    [key]: excluded
                      ? [...current.filter((i) => i !== rowIndex), rowIndex]
                      : current.filter((i) => i !== rowIndex),
                  };
                })
              }
              invalidCount={validationResults.filter((r) => !r.isValid).length}
            />
          )}

          {step === "summary" && (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-500">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
              <p className="text-slate-400 mb-6 max-w-sm">
                Successfully imported <strong>{summary.imported}</strong>{" "}
                entries.
                {summary.skippedDuplicates > 0 &&
                  ` ${summary.skippedDuplicates} duplicate rows were skipped.`}
                {summary.skippedInvalid > 0 &&
                  ` ${summary.skippedInvalid} rows were skipped due to validation errors.`}
              </p>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="w-full max-w-xs"
              >
                Back to Journal
              </Button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step !== "summary" && step !== "upload" && (
          <div className="border-t border-white/10 p-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (step === "mapping") setStep("upload");
                else if (step === "preview") setStep("mapping");
                else if (step === "duplicates") setStep("preview");
                setRestoredFromSession(false);
              }}
              className="gap-2"
            >
              <ChevronLeft size={16} className="rtl-flip" /> Back
            </Button>

            {step === "mapping" && (
              <Button
                onClick={validateRows}
                disabled={mappingIssues.length > 0 || isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    Preview <ChevronRight size={16} />
                  </>
                )}
              </Button>
            )}

            {/* From preview, proceed to duplicates step if groups exist, else import */}
            {step === "preview" && (
              <Button
                onClick={() => {
                  if (duplicateGroups.length > 0) {
                    setStep("duplicates");
                  } else {
                    handleImport();
                  }
                }}
                disabled={validationResults.every((r) => !r.isValid)}
                className="gap-2 bg-emerald-500 hover:bg-emerald-600"
              >
                {duplicateGroups.length > 0 ? (
                  <>
                    Resolve Duplicates <ChevronRight size={16} />
                  </>
                ) : (
                  <>
                    Confirm Import <ArrowRight size={16} />
                  </>
                )}
              </Button>
            )}

            {/* From duplicates, proceed to import */}
            {step === "duplicates" && (
              <Button
                onClick={handleImport}
                className="gap-2 bg-emerald-500 hover:bg-emerald-600"
              >
                Confirm Import <ArrowRight size={16} />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
