import { CSV_PRESETS, type TaxEntry, type TaxReport } from "@/lib/taxUtils";

export type DateFormat = "iso" | "us" | "eu";
export type DecimalSeparator = "." | ",";
export type CurrencyStyle = "none" | "symbol" | "code";
export type CsvDelimiter = "," | ";";

export interface TaxFormatOptions {
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  currencyStyle: CurrencyStyle;
  delimiter: CsvDelimiter;
}

/** Produces exactly the output of the existing generic CSV preset. */
export const DEFAULT_TAX_FORMAT: TaxFormatOptions = {
  dateFormat: "iso",
  decimalSeparator: ".",
  currencyStyle: "none",
  delimiter: ",",
};

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  iso: "YYYY-MM-DD",
  us: "MM/DD/YYYY",
  eu: "DD/MM/YYYY",
};

export function isDefaultFormat(options: TaxFormatOptions): boolean {
  return (Object.keys(DEFAULT_TAX_FORMAT) as Array<keyof TaxFormatOptions>).every((k) => options[k] === DEFAULT_TAX_FORMAT[k]);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date in UTC, like the existing exports (which use the ISO date). */
export function formatTaxDate(date: Date, options: TaxFormatOptions): string {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  if (options.dateFormat === "us") return `${m}/${d}/${y}`;
  if (options.dateFormat === "eu") return `${d}/${m}/${y}`;
  return `${y}-${m}-${d}`;
}

export function formatTaxNumber(value: number, decimals: number, options: TaxFormatOptions): string {
  const text = value.toFixed(decimals);
  return options.decimalSeparator === "," ? text.replace(".", ",") : text;
}

export function formatTaxMoney(value: number, decimals: number, options: TaxFormatOptions): string {
  const text = formatTaxNumber(value, decimals, options);
  if (options.currencyStyle === "none") return text;
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const sign = negative ? "-" : "";
  return options.currencyStyle === "symbol" ? `${sign}$${body}` : `${sign}${body} USD`;
}

/** The cells of one generic-preset row, formatted. Preview and download both use this. */
export function formatGenericRow(entry: TaxEntry, options: TaxFormatOptions): string[] {
  return [
    formatTaxDate(entry.date, options),
    entry.assetPair,
    formatTaxNumber(entry.amount, 6, options),
    formatTaxMoney(entry.costBasis, 2, options),
    formatTaxMoney(entry.proceeds, 2, options),
    formatTaxMoney(entry.gainLoss, 2, options),
    formatTaxMoney(entry.fees, 4, options),
    entry.isLongTerm ? "Long-term" : "Short-term",
    entry.foreignCurrency ?? "",
    entry.conversionRate != null ? formatTaxNumber(entry.conversionRate, 6, options) : "",
  ];
}

function quote(value: string): string {
  return `"${value}"`;
}

/** Generic CSV with the chosen formatting. With the default options it equals the existing generic export. */
export function generateFormattedGenericCsv(report: TaxReport, options: TaxFormatOptions): string {
  const rows = report.entries.map((entry) => formatGenericRow(entry, options));
  return [CSV_PRESETS.generic.headers, ...rows].map((r) => r.map(quote).join(options.delimiter)).join("\n");
}

/** Example entry used when the report has no rows, clearly labelled as an example by the UI. */
export const SAMPLE_ENTRY: TaxEntry = {
  id: "sample",
  assetPair: "XLM/USDC",
  amount: 1234.5,
  costBasis: 1500.25,
  proceeds: 1650.75,
  gainLoss: 150.5,
  fees: 0.0004,
  isLongTerm: false,
  date: new Date(Date.UTC(2025, 2, 14)),
};

export interface FormatPreview {
  headers: string[];
  rows: string[][];
  /** True when the rows are a fixed example because the report has no entries. */
  isExample: boolean;
}

/** First rows exactly as they will appear in the downloaded file. */
export function previewFormattedRows(report: TaxReport, options: TaxFormatOptions, limit = 3): FormatPreview {
  const source = report.entries.length > 0 ? report.entries.slice(0, limit) : [SAMPLE_ENTRY];
  return {
    headers: CSV_PRESETS.generic.headers,
    rows: source.map((entry) => formatGenericRow(entry, options)),
    isExample: report.entries.length === 0,
  };
}
