import {
  assessMarketContextChange,
  MARKET_CONTEXT_MAX_AGE_MS,
  MATERIAL_MARKET_MOVE_PERCENT,
  type MarketContextQuote,
} from "@/lib/marketContextChange";

const NOW = Date.parse("2026-11-21T12:00:00.000Z");
const reference: MarketContextQuote = {
  pair: "XLM/USDC",
  price: 0.5,
  observedAt: "2026-11-21T11:00:00.000Z",
  source: "Signal quote feed",
};
const current: MarketContextQuote = {
  pair: "XLM/USDC",
  price: 0.515,
  observedAt: "2026-11-21T11:59:00.000Z",
  source: "Current quote feed",
};

function assess(
  ref: MarketContextQuote | null = reference,
  latest: MarketContextQuote | null = current,
  label: string | null = "Recommendation issued",
) {
  return assessMarketContextChange(ref, latest, label, NOW);
}

describe("assessMarketContextChange", () => {
  it("flags a material upward move and retains the reference context", () => {
    const result = assess();

    expect(result).toMatchObject({
      comparable: true,
      changePercent: 3,
      materiallyChanged: true,
      referenceTime: Date.parse(reference.observedAt!),
      currentTime: Date.parse(current.observedAt!),
    });
  });

  it("does not flag moves smaller than the materiality threshold", () => {
    const result = assess(reference, { ...current, price: 0.505 });

    expect(result).toMatchObject({ comparable: true, changePercent: 1, materiallyChanged: false });
  });

  it("uses an absolute change threshold for downward moves", () => {
    const result = assess(reference, { ...current, price: 0.49 });

    expect(result).toMatchObject({ comparable: true, changePercent: -2, materiallyChanged: true });
  });

  it.each([
    [null, current, "Recommendation issued"],
    [reference, null, "Recommendation issued"],
    [{ ...reference, price: null }, current, "Recommendation issued"],
    [{ ...reference, observedAt: null }, current, "Recommendation issued"],
    [reference, { ...current, observedAt: "invalid" }, "Recommendation issued"],
    [reference, current, "  "],
    [reference, { ...current, pair: "BTC/USDC" }, "Recommendation issued"],
  ] as const)("refuses to infer movement when required context is missing or mismatched", (ref, latest, label) => {
    const result = assess(ref, latest, label);
    expect(result.comparable).toBe(false);
  });

  it("does not compare an old current quote", () => {
    const staleQuote = {
      ...current,
      observedAt: new Date(NOW - MARKET_CONTEXT_MAX_AGE_MS - 1).toISOString(),
    };
    expect(assess(reference, staleQuote)).toMatchObject({
      comparable: false,
      reason: "The current quote is too old to compare.",
    });
  });

  it("does not compare a future-dated quote", () => {
    const futureQuote = { ...current, observedAt: new Date(NOW + 1).toISOString() };
    expect(assess(reference, futureQuote)).toMatchObject({ comparable: false });
  });

  it("keeps the threshold explicit", () => {
    expect(MATERIAL_MARKET_MOVE_PERCENT).toBe(2);
  });
});
