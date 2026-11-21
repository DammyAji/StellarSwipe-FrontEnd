import { taxYearOf, type TaxableTransaction } from "@/lib/taxUtils";

export interface YearDataSummary {
  year: number;
  /** Number of transactions available for the year. */
  count: number;
  hasData: boolean;
}

/** How many transactions exist for each requested tax year (in the reporting timezone). */
export function summarizeYearData(
  transactions: readonly Pick<TaxableTransaction, "timestamp">[],
  years: readonly number[]
): YearDataSummary[] {
  const counts = new Map<number, number>();
  for (const tx of transactions) {
    const year = taxYearOf(tx.timestamp);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return years.map((year) => {
    const count = counts.get(year) ?? 0;
    return { year, count, hasData: count > 0 };
  });
}

/** Label for the year picker: states whether the year has any transaction data. */
export function yearOptionLabel(summary: YearDataSummary): string {
  return summary.hasData ? `${summary.year} (${summary.count} transaction${summary.count === 1 ? "" : "s"})` : `${summary.year} (no data)`;
}

export const EMPTY_YEAR_MESSAGE =
  "No transaction data has been imported for this year. An empty report here does not mean you had no taxable events; import or review your records first.";
