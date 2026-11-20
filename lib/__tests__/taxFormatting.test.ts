import {
  DEFAULT_TAX_FORMAT,
  formatTaxDate,
  formatTaxMoney,
  generateFormattedGenericCsv,
  isDefaultFormat,
  previewFormattedRows,
  SAMPLE_ENTRY,
  type TaxFormatOptions,
} from "@/lib/taxFormatting";
import { computeTaxReport, exportToCsvWithPreset, type TaxableTransaction } from "@/lib/taxUtils";

const txs: TaxableTransaction[] = [
  { id: "a", assetPair: "XLM/USDC", amount: 1234.5, buyPrice: 1, sellPrice: 1.3, fee: 0.5, timestamp: Date.UTC(2025, 2, 14, 12), acquisitionDate: new Date(2023, 0, 1).getTime(), foreignCurrency: "EUR", conversionRate: 0.92 },
  { id: "b", assetPair: "AQUA/XLM", amount: 10, buyPrice: 2, sellPrice: 1.5, fee: 0.0004, timestamp: Date.UTC(2025, 5, 1, 12) },
];
const report = computeTaxReport(txs, 2025, "US");
const custom = (o: Partial<TaxFormatOptions>): TaxFormatOptions => ({ ...DEFAULT_TAX_FORMAT, ...o });

describe("default formatting", () => {
  it("produces exactly the existing generic CSV", () => {
    expect(generateFormattedGenericCsv(report, DEFAULT_TAX_FORMAT)).toBe(exportToCsvWithPreset(report, "generic"));
    expect(isDefaultFormat(DEFAULT_TAX_FORMAT)).toBe(true);
    expect(isDefaultFormat(custom({ delimiter: ";" }))).toBe(false);
  });
});

describe("formatTaxDate", () => {
  const date = new Date(Date.UTC(2025, 2, 4));
  it("formats ISO, US and EU dates", () => {
    expect(formatTaxDate(date, custom({ dateFormat: "iso" }))).toBe("2025-03-04");
    expect(formatTaxDate(date, custom({ dateFormat: "us" }))).toBe("03/04/2025");
    expect(formatTaxDate(date, custom({ dateFormat: "eu" }))).toBe("04/03/2025");
  });
});

describe("formatTaxMoney", () => {
  it("applies decimal separator and currency style, including negatives", () => {
    expect(formatTaxMoney(1234.5, 2, custom({ decimalSeparator: "," }))).toBe("1234,50");
    expect(formatTaxMoney(1234.5, 2, custom({ currencyStyle: "symbol" }))).toBe("$1234.50");
    expect(formatTaxMoney(-12.5, 2, custom({ currencyStyle: "symbol" }))).toBe("-$12.50");
    expect(formatTaxMoney(-12.5, 2, custom({ currencyStyle: "code", decimalSeparator: "," }))).toBe("-12,50 USD");
    expect(formatTaxMoney(-12.5, 2, DEFAULT_TAX_FORMAT)).toBe("-12.50");
  });
});

describe("previewFormattedRows and the downloaded file", () => {
  const options = custom({ dateFormat: "eu", decimalSeparator: ",", currencyStyle: "code", delimiter: ";" });

  it("preview rows are the same cells that the CSV contains", () => {
    const preview = previewFormattedRows(report, options, 2);
    const csvLines = generateFormattedGenericCsv(report, options).split("\n");
    expect(preview.isExample).toBe(false);
    expect(preview.rows).toHaveLength(2);
    preview.rows.forEach((row, i) => expect(csvLines[i + 1]).toBe(row.map((c) => `"${c}"`).join(";")));
    expect(csvLines[0]).toBe(preview.headers.map((h) => `"${h}"`).join(";"));
  });

  it("changes when the formatting changes", () => {
    const a = previewFormattedRows(report, DEFAULT_TAX_FORMAT).rows[0];
    const b = previewFormattedRows(report, options).rows[0];
    expect(a[0]).toBe("2025-03-14");
    expect(b[0]).toBe("14/03/2025");
    expect(b[3]).toContain(" USD");
    expect(a).not.toEqual(b);
  });

  it("shows a labelled example when the report has no rows", () => {
    const empty = computeTaxReport([], 2025, "US");
    const preview = previewFormattedRows(empty, options);
    expect(preview.isExample).toBe(true);
    expect(preview.rows).toHaveLength(1);
    expect(SAMPLE_ENTRY.id).toBe("sample");
  });
});
