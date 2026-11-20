import { buildLineItemSources, hasReceiptHash, summarizeSources } from "@/lib/taxLineSources";
import { computeTaxReport, type TaxableTransaction } from "@/lib/taxUtils";

const HASH = "b3f9c18e6b7a4cd81d2f3a9ed7f8c6b9f2d7a1b3c4e5f6a7b8c9d0e1f2a3b4c";
const ts = new Date(2025, 5, 1).getTime();

const tx = (id: string, hash: string | undefined, sellPrice = 12): TaxableTransaction => ({
  id,
  assetPair: "XLM/USDC",
  amount: 10,
  buyPrice: 10,
  sellPrice,
  fee: 0,
  timestamp: ts,
  source: hash === undefined ? undefined : { hash, type: "COPY_TRADE" },
});

describe("hasReceiptHash", () => {
  it("accepts real hashes and rejects placeholders", () => {
    expect(hasReceiptHash(HASH)).toBe(true);
    expect(hasReceiptHash("manual-18f3a2b1c4d5e6f7")).toBe(false);
    expect(hasReceiptHash("csv-18f3a2b1c4d5e6f7")).toBe(false);
    expect(hasReceiptHash(undefined)).toBe(false);
  });
});

describe("buildLineItemSources", () => {
  const txs = [tx("a", HASH), tx("b", "manual-18f3a2b1c4d5e6f7", 8), tx("c", undefined, 11)];
  const report = computeTaxReport(txs, 2025, "US");
  const byId = new Map(txs.map((t) => [t.id, t]));

  it("links on-chain lines to their receipt", () => {
    const [a] = buildLineItemSources(report.entries, byId, "testnet");
    expect(a.status).toBe("linked");
    expect(a.sources[0].receiptUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`);
    expect(a.reason).toBeNull();
  });

  it("discloses lines whose record has no on-chain hash instead of hiding them", () => {
    const items = buildLineItemSources(report.entries, byId);
    expect(items.map((i) => i.status)).toEqual(["linked", "partial", "partial"]);
    expect(items[1].sources[0].receiptUrl).toBeNull();
    expect(items[1].reason).toMatch(/no on-chain transaction hash/);
  });

  it("marks a line missing when its source record cannot be found", () => {
    const items = buildLineItemSources(report.entries, new Map([["a", txs[0]]]));
    expect(items[2]).toMatchObject({ status: "missing", sources: [] });
    expect(items[2].reason).toMatch(/could not be found/);
  });

  it("keeps every line so totals still equal the report total", () => {
    const items = buildLineItemSources(report.entries, new Map());
    const summary = summarizeSources(items);
    expect(items).toHaveLength(report.entries.length);
    expect(summary).toMatchObject({ total: 3, linked: 0, partial: 0, missing: 3 });
    expect(summary.totalGainLoss).toBeCloseTo(report.totalGainLoss, 10);
  });
});
