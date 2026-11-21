import type { ExportPreviewIssue } from "@/components/ExportPreviewDialog";

export interface ExportScopeInput {
  /** Columns the user has hidden in the on-screen table. */
  hiddenColumns?: { key: string; label: string }[];
  /** Filters currently applied to the visible data. */
  activeFilters?: { label: string; value: string }[];
  /** Total rows currently visible on screen. */
  visibleRowCount?: number;
  /** Rows the export will actually contain. */
  exportedRowCount?: number;
}

/**
 * #1059 Warn when report settings exclude data that is currently visible.
 *
 * Returns non-blocking warnings describing hidden columns and active filters
 * that narrow the export, so the review dialog can let the user proceed
 * intentionally or go back and adjust settings. A full export (no hidden
 * columns, no filters, same row count) yields an empty list.
 */
export function getExportScopeWarnings({
  hiddenColumns = [],
  activeFilters = [],
  visibleRowCount,
  exportedRowCount,
}: ExportScopeInput): ExportPreviewIssue[] {
  const warnings: ExportPreviewIssue[] = [];

  if (hiddenColumns.length > 0) {
    const labels = hiddenColumns.map((column) => column.label).join(", ");
    warnings.push({
      message: `${hiddenColumns.length} hidden column${
        hiddenColumns.length === 1 ? "" : "s"
      } will be left out of this export: ${labels}.`,
    });
  }

  if (activeFilters.length > 0) {
    const labels = activeFilters
      .map((filter) => `${filter.label}: ${filter.value}`)
      .join("; ");
    warnings.push({
      message: `Active filters limit this export to a subset of your data (${labels}).`,
    });
  }

  if (
    typeof visibleRowCount === "number" &&
    typeof exportedRowCount === "number" &&
    exportedRowCount < visibleRowCount
  ) {
    warnings.push({
      message: `This export contains ${exportedRowCount} of the ${visibleRowCount} rows currently visible.`,
    });
  }

  return warnings;
}
