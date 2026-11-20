"use client";

import { useMemo } from "react";
import {
  DATE_FORMAT_LABELS,
  previewFormattedRows,
  type CsvDelimiter,
  type CurrencyStyle,
  type DateFormat,
  type DecimalSeparator,
  type TaxFormatOptions,
} from "@/lib/taxFormatting";
import type { CsvPreset, TaxReport } from "@/lib/taxUtils";

interface TaxFormatPreviewProps {
  report: TaxReport;
  preset: CsvPreset;
  options: TaxFormatOptions;
  onChange: (options: TaxFormatOptions) => void;
}

const SELECT_CLASS =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

/** Formatting controls and a live preview of the first rows exactly as they will be downloaded. */
export function TaxFormatPreview({ report, preset, options, onChange }: TaxFormatPreviewProps) {
  const supported = preset === "generic";
  const preview = useMemo(() => previewFormattedRows(report, options), [report, options]);

  return (
    <fieldset className="rounded-md border border-border/60 p-3" data-testid="tax-format-preview">
      <legend className="px-1 text-xs font-medium text-foreground-muted">Date and number formatting</legend>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Date
          <select
            className={SELECT_CLASS}
            value={options.dateFormat}
            disabled={!supported}
            onChange={(e) => onChange({ ...options, dateFormat: e.target.value as DateFormat })}
          >
            {(Object.keys(DATE_FORMAT_LABELS) as DateFormat[]).map((key) => (
              <option key={key} value={key}>
                {DATE_FORMAT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Decimal separator
          <select
            className={SELECT_CLASS}
            value={options.decimalSeparator}
            disabled={!supported}
            onChange={(e) => onChange({ ...options, decimalSeparator: e.target.value as DecimalSeparator })}
          >
            <option value=".">Period (1234.50)</option>
            <option value=",">Comma (1234,50)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Currency
          <select
            className={SELECT_CLASS}
            value={options.currencyStyle}
            disabled={!supported}
            onChange={(e) => onChange({ ...options, currencyStyle: e.target.value as CurrencyStyle })}
          >
            <option value="none">Number only</option>
            <option value="symbol">Symbol ($)</option>
            <option value="code">Code (USD)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Column separator
          <select
            className={SELECT_CLASS}
            value={options.delimiter}
            disabled={!supported}
            onChange={(e) => onChange({ ...options, delimiter: e.target.value as CsvDelimiter })}
          >
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
          </select>
        </label>
      </div>

      {!supported && (
        <p className="mt-2 text-xs text-foreground-muted" role="status">
          Formatting applies to the Generic Spreadsheet format. CoinTracker and Koinly use the format those services require.
        </p>
      )}

      {supported && (
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-[11px] text-foreground-subtle" aria-live="polite">
            {preview.isExample
              ? "This year has no rows yet, so an example row is shown."
              : "First rows of the file, as they will be downloaded:"}
          </p>
          <table className="w-full text-[11px]" aria-label="Formatted export preview">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                {preview.headers.map((h) => (
                  <th key={h} className="pb-1 pr-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/40 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1 pr-3 font-mono text-foreground">
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </fieldset>
  );
}
