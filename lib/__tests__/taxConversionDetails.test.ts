import { conversionSummaryText, describeConversion, summarizeConversions, UNAVAILABLE } from "@/lib/taxConversionDetails";
import type { TaxEntry } from "@/lib/taxUtils";

const tx = Date.UTC(2025, 2, 14, 12, 0, 0);

const base: TaxEntry = {
  id: "e1",
  assetPair: "XLM/EUR",
  amount: 10,
  costBasis: 5,
  proceeds: 6,
  gainLoss: 1,
  fees: 0.1,
  isLongTerm: false,
  date: new Date(tx),
  foreignCurrency: "EUR",
  conversionRate: 0.92,
};

describe("describeConversion", () => {
  it("returns null for lines that were not converted", () => {
    expect(describeConversion({ ...base, foreignCurrency: undefined })).toBeNull();
  });

  it("marks missing source and lookup time unavailable and keeps transaction time separate", () => {
    const d = describeConversion(base)!;
    expect(d.rate).toBe("0.920000");
    expect(d.source).toBe(UNAVAILABLE);
    expect(d.sourceAvailable).toBe(false);
    expect(d.lookedUpAt).toBe(UNAVAILABLE);
    expect(d.lookupAvailable).toBe(false);
    expect(d.transactionTime).toBe("2025-03-14 12:00:00 UTC");
    expect(d.timingNote).toBeNull();
  });

  it("shows source and lookup time distinct from the transaction time", () => {
    const d = describeConversion({ ...base, conversionRateSource: "  ECB  ", conversionRateLookupTimestamp: tx - 5 * 60_000 })!;
    expect(d.source).toBe("ECB");
    expect(d.lookedUpAt).toBe("2025-03-14 11:55:00 UTC");
    expect(d.transactionTime).toBe("2025-03-14 12:00:00 UTC");
    expect(d.timingNote).toBe("Rate looked up 5 minutes before the transaction.");
  });

  it("describes lookups after the transaction and at the same moment", () => {
    expect(describeConversion({ ...base, conversionRateLookupTimestamp: tx + 3 * 3_600_000 })!.timingNote).toBe(
      "Rate looked up 3 hours after the transaction."
    );
    expect(describeConversion({ ...base, conversionRateLookupTimestamp: tx + 10_000 })!.timingNote).toBe("Rate looked up at the transaction time.");
  });

  it("treats invalid rates and timestamps as unavailable", () => {
    const d = describeConversion({ ...base, conversionRate: Number.NaN, conversionRateLookupTimestamp: Number.NaN })!;
    expect(d.rateAvailable).toBe(false);
    expect(d.rate).toBe(UNAVAILABLE);
    expect(d.lookupAvailable).toBe(false);
    expect(describeConversion({ ...base, conversionRate: 0 })!.rateAvailable).toBe(false);
  });
});

describe("summarizeConversions", () => {
  const complete: TaxEntry = { ...base, id: "e2", conversionRateSource: "ECB", conversionRateLookupTimestamp: tx };
  it("counts converted lines and missing metadata", () => {
    const summary = summarizeConversions([base, complete, { ...base, id: "e3", foreignCurrency: undefined }]);
    expect(summary).toEqual({ converted: 2, missingRate: 0, missingSource: 1, missingLookupTime: 1 });
    expect(conversionSummaryText(summary)).toBe("2 converted: 1 without a rate source, 1 without a lookup time (1 complete)");
  });
  it("describes the empty and complete cases", () => {
    expect(conversionSummaryText(summarizeConversions([]))).toBe("No converted entries");
    expect(conversionSummaryText(summarizeConversions([complete]))).toBe("1 converted, all with rate, source and lookup time");
  });
});
