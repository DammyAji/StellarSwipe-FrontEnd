export type TaxJurisdiction = "US" | "UK" | "EU" | "CA";

export interface TaxRate {
  shortTerm: number;
  longTerm: number;
  label: string;
}

export const TAX_RATES: Record<TaxJurisdiction, TaxRate> = {
  US: { shortTerm: 0.22, longTerm: 0.15, label: "United States" },
  UK: { shortTerm: 0.2, longTerm: 0.2, label: "United Kingdom" },
  EU: { shortTerm: 0.25, longTerm: 0.25, label: "European Union" },
  CA: { shortTerm: 0.265, longTerm: 0.1325, label: "Canada" },
};

export const LONG_TERM_THRESHOLD_DAYS = 365;

/**
 * Timezone used to interpret tax-year boundaries (#1060). Tax years are
 * calendar years in the reporting timezone, not in the user's local timezone,
 * so review, report and exports all agree on which year a trade falls in.
 */
export const TAX_REPORTING_TIME_ZONE = "UTC";

/** Calendar year of an instant in the reporting timezone. */
export function taxYearOf(
  timestamp: number,
  timeZone: string = TAX_REPORTING_TIME_ZONE
): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(
      new Date(timestamp)
    )
  );
}

/** `YYYY-MM-DD` calendar date of an instant in the reporting timezone. */
export function taxDateKey(
  timestamp: number,
  timeZone: string = TAX_REPORTING_TIME_ZONE
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Inclusive start / exclusive end instants of a tax year in the reporting timezone. */
export function taxYearBounds(
  year: number,
  timeZone: string = TAX_REPORTING_TIME_ZONE
): { start: number; end: number } {
  return {
    start: Date.parse(`${year}-01-01T00:00:00Z`),
    end: Date.parse(`${year + 1}-01-01T00:00:00Z`),
  };
}

export interface TaxableTransaction {
  id: string;
  assetPair: string;
  amount: number;
  buyPrice: number;
  sellPrice: number;
  fee: number;
  timestamp: number;
  acquisitionDate?: number;
  foreignCurrency?: string;
  conversionRate?: number;
  /** Where the conversion rate came from (an exchange or oracle name), when known. */
  conversionRateSource?: string;
  /** When the rate was looked up (epoch ms), when known. Distinct from the transaction time. */
  conversionRateLookupTimestamp?: number;
  /** Origin details used to identify the record during review (#894). */
  source?: TaxTransactionSource;
}

export interface TaxTransactionSource {
  /** On-chain transaction hash, when known. */
  hash?: string;
  /** How the trade was placed, e.g. COPY_TRADE, SWAP, MANUAL. */
  type?: string;
}

export interface TaxEntry {
  id: string;
  assetPair: string;
  amount: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  fees: number;
  isLongTerm: boolean;
  date: Date;
  foreignCurrency?: string;
  conversionRate?: number;
  conversionRateSource?: string;
  conversionRateLookupTimestamp?: number;
}

export interface TaxReport {
  year: number;
  jurisdiction: TaxJurisdiction;
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  totalFees: number;
  totalGainLoss: number;
  estimatedTaxLiability: number;
  entries: TaxEntry[];
}

export function computeGainLoss(
  buyPrice: number,
  sellPrice: number,
  amount: number,
  fee: number = 0
): number {
  const proceeds = sellPrice * amount;
  const costBasis = buyPrice * amount + fee;
  return proceeds - costBasis;
}

export function isLongTermHolding(
  acquisitionTimestamp: number,
  disposalTimestamp: number
): boolean {
  const diffMs = disposalTimestamp - acquisitionTimestamp;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= LONG_TERM_THRESHOLD_DAYS;
}

export function computeTaxReport(
  transactions: TaxableTransaction[],
  year: number,
  jurisdiction: TaxJurisdiction
): TaxReport {
  const rates = TAX_RATES[jurisdiction];
  const { start: startOfYear, end: endOfYear } = taxYearBounds(year);

  const yearTransactions = transactions.filter(
    (tx) => tx.timestamp >= startOfYear && tx.timestamp < endOfYear
  );

  const entries: TaxEntry[] = yearTransactions.map((tx) => {
    const gainLoss = computeGainLoss(
      tx.buyPrice,
      tx.sellPrice,
      tx.amount,
      tx.fee
    );
    const longTerm = tx.acquisitionDate
      ? isLongTermHolding(tx.acquisitionDate, tx.timestamp)
      : false;
    return {
      id: tx.id,
      assetPair: tx.assetPair,
      amount: tx.amount,
      costBasis: tx.buyPrice * tx.amount,
      proceeds: tx.sellPrice * tx.amount,
      gainLoss,
      fees: tx.fee,
      isLongTerm: longTerm,
      date: new Date(tx.timestamp),
      foreignCurrency: tx.foreignCurrency,
      conversionRate: tx.conversionRate,
      conversionRateSource: tx.conversionRateSource,
      conversionRateLookupTimestamp: tx.conversionRateLookupTimestamp,
    };
  });

  const shortTermGains = entries
    .filter((e) => !e.isLongTerm && e.gainLoss > 0)
    .reduce((sum, e) => sum + e.gainLoss, 0);
  const longTermGains = entries
    .filter((e) => e.isLongTerm && e.gainLoss > 0)
    .reduce((sum, e) => sum + e.gainLoss, 0);
  const shortTermLosses = Math.abs(
    entries
      .filter((e) => !e.isLongTerm && e.gainLoss < 0)
      .reduce((sum, e) => sum + e.gainLoss, 0)
  );
  const longTermLosses = Math.abs(
    entries
      .filter((e) => e.isLongTerm && e.gainLoss < 0)
      .reduce((sum, e) => sum + e.gainLoss, 0)
  );

  const totalFees = entries.reduce((sum, e) => sum + e.fees, 0);
  const netShortTerm = shortTermGains - shortTermLosses;
  const netLongTerm = longTermGains - longTermLosses;
  const totalGainLoss = netShortTerm + netLongTerm;
  const estimatedTaxLiability =
    Math.max(0, netShortTerm) * rates.shortTerm +
    Math.max(0, netLongTerm) * rates.longTerm;

  return {
    year,
    jurisdiction,
    shortTermGains,
    longTermGains,
    shortTermLosses,
    longTermLosses,
    totalFees,
    totalGainLoss,
    estimatedTaxLiability,
    entries,
  };
}

export type CsvPreset = "generic" | "cointracker" | "koinly";

export interface CsvPresetDefinition {
  label: string;
  headers: string[];
  row: (e: TaxEntry) => string[];
}

export const CSV_PRESETS: Record<CsvPreset, CsvPresetDefinition> = {
  generic: {
    label: "Generic Spreadsheet",
    headers: [
      "Date",
      "Asset Pair",
      "Amount",
      "Cost Basis (USD)",
      "Proceeds (USD)",
      "Gain/Loss (USD)",
      "Fees (USD)",
      "Term",
      "Foreign Currency",
      "Conversion Rate",
    ],
    row: (e) => [
      taxDateKey(e.date.getTime()),
      e.assetPair,
      e.amount.toFixed(6),
      e.costBasis.toFixed(2),
      e.proceeds.toFixed(2),
      e.gainLoss.toFixed(2),
      e.fees.toFixed(4),
      e.isLongTerm ? "Long-term" : "Short-term",
      e.foreignCurrency ?? "",
      e.conversionRate != null ? e.conversionRate.toFixed(6) : "",
    ],
  },
  cointracker: {
    label: "CoinTracker",
    headers: [
      "Date",
      "Received Quantity",
      "Received Currency",
      "Sent Quantity",
      "Sent Currency",
      "Fee Amount",
      "Fee Currency",
      "Tag",
    ],
    row: (e) => {
      const [base, quote] = e.assetPair.split("/");
      return [
        taxDateKey(e.date.getTime()),
        e.proceeds.toFixed(2),
        quote ?? "USD",
        e.amount.toFixed(6),
        base ?? e.assetPair,
        e.fees.toFixed(4),
        quote ?? "USD",
        e.isLongTerm ? "long-term" : "short-term",
      ];
    },
  },
  koinly: {
    label: "Koinly",
    headers: [
      "Date",
      "Sent Amount",
      "Sent Currency",
      "Received Amount",
      "Received Currency",
      "Fee Amount",
      "Fee Currency",
      "Net Worth Amount",
      "Net Worth Currency",
      "Label",
      "Description",
      "TxHash",
    ],
    row: (e) => {
      const [base, quote] = e.assetPair.split("/");
      return [
        e.date.toISOString(),
        e.amount.toFixed(6),
        base ?? e.assetPair,
        e.proceeds.toFixed(2),
        quote ?? "USD",
        e.fees.toFixed(4),
        quote ?? "USD",
        e.proceeds.toFixed(2),
        quote ?? "USD",
        "",
        e.assetPair,
        e.id,
      ];
    },
  },
};

export function exportToCsvWithPreset(
  report: TaxReport,
  preset: CsvPreset = "generic"
): string {
  const { headers, row } = CSV_PRESETS[preset];
  const rows = report.entries.map(row);
  return [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");
}

export function exportToCsv(report: TaxReport): string {
  return exportToCsvWithPreset(report, "generic");
}

export function formatForTurboTax(report: TaxReport): string {
  const lines: string[] = [
    "V042",
    "A TurboTax Export - StellarSwipe",
    `D${new Date().toLocaleDateString("en-US")}`,
    "^",
  ];
  report.entries.forEach((e) => {
    lines.push(
      "TD",
      `N${e.assetPair}`,
      `D${taxDateKey(e.date.getTime())}`,
      `$${e.proceeds.toFixed(2)}`,
      `$${e.costBasis.toFixed(2)}`,
      "^"
    );
  });
  return lines.join("\n");
}

export function formatForTaxAct(report: TaxReport): string {
  const headers = [
    "Description",
    "Date Acquired",
    "Date Sold",
    "Proceeds",
    "Cost Basis",
    "Gain/Loss",
  ];
  const rows = report.entries.map((e) => [
    e.assetPair,
    "Various",
    taxDateKey(e.date.getTime()),
    e.proceeds.toFixed(2),
    e.costBasis.toFixed(2),
    e.gainLoss.toFixed(2),
  ]);
  return [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(","))
    .join("\n");
}

export function triggerDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Multi-year comparison utilities (#351)
// ---------------------------------------------------------------------------

export interface MultiYearSummaryRow {
  year: number;
  totalGainLoss: number;
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  totalFees: number;
  estimatedTaxLiability: number;
  tradeCount: number;
}

/**
 * Computes a summary row for each supplied year so callers can drive a
 * multi-year comparison table or chart.
 */
export function computeMultiYearSummary(
  transactions: TaxableTransaction[],
  years: number[],
  jurisdiction: TaxJurisdiction
): MultiYearSummaryRow[] {
  return years.map((year) => {
    const report = computeTaxReport(transactions, year, jurisdiction);
    return {
      year,
      totalGainLoss: report.totalGainLoss,
      shortTermGains: report.shortTermGains,
      longTermGains: report.longTermGains,
      shortTermLosses: report.shortTermLosses,
      longTermLosses: report.longTermLosses,
      totalFees: report.totalFees,
      estimatedTaxLiability: report.estimatedTaxLiability,
      tradeCount: report.entries.length,
    };
  });
}

/**
 * Exports a multi-year comparison summary as CSV.
 * The resulting file clearly labels each row by year.
 */
export function exportMultiYearCsv(
  rows: MultiYearSummaryRow[],
  jurisdiction: TaxJurisdiction
): string {
  const headers = [
    "Tax Year",
    "Jurisdiction",
    "Net Gain/Loss (USD)",
    "Short-Term Gains (USD)",
    "Long-Term Gains (USD)",
    "Short-Term Losses (USD)",
    "Long-Term Losses (USD)",
    "Total Fees (USD)",
    "Est. Tax Liability (USD)",
    "Trade Count",
  ];
  const dataRows = rows.map((r) => [
    String(r.year),
    jurisdiction,
    r.totalGainLoss.toFixed(2),
    r.shortTermGains.toFixed(2),
    r.longTermGains.toFixed(2),
    r.shortTermLosses.toFixed(2),
    r.longTermLosses.toFixed(2),
    r.totalFees.toFixed(4),
    r.estimatedTaxLiability.toFixed(2),
    String(r.tradeCount),
  ]);
  return [headers, ...dataRows]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\n");
}
