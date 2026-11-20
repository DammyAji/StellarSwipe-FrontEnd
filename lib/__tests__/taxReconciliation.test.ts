import { applyDecisions, countByStatus, parseImportedRows, reconcileRows, type ImportedTaxRow } from "@/lib/taxReconciliation";
import type { TaxableTransaction } from "@/lib/taxUtils";

const day = (d: number) => Date.UTC(2025, 0, d, 12);

const tx = (id: string, over: Partial<TaxableTransaction> = {}): TaxableTransaction => ({
  id,
  assetPair: "XLM/USDC",
  amount: 100,
  buyPrice: 1,
  sellPrice: 1.1,
  fee: 0,
  timestamp: day(10),
  ...over,
});

const row = (rowId: string, over: Partial<ImportedTaxRow> = {}): ImportedTaxRow => ({
  rowId,
  date: "2025-01-10",
  assetPair: "XLM/USDC",
  amount: 100,
  ...over,
});

describe("parseImportedRows", () => {
  it("reads rows with flexible headers and reports bad rows instead of dropping them silently", () => {
    const csv = ["Date,Pair,Quantity,Tx Hash", "2025-01-10,XLM/USDC,\"1,000.5\",abc123", "not-a-date,XLM/USDC,5,", "2025-01-11,,5,", "2025-01-12,XLM/USDC,-3,"].join("\n");
    const result = parseImportedRows(csv);
    expect(result.rows).toEqual([{ rowId: "1", date: "2025-01-10", assetPair: "XLM/USDC", amount: 1000.5, hash: "abc123" }]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toMatch(/Row 2: the date/);
    expect(result.errors[1]).toMatch(/Row 3: the asset pair is empty/);
    expect(result.errors[2]).toMatch(/Row 4: the amount/);
  });

  it("fails clearly when required columns are missing", () => {
    const result = parseImportedRows("Foo,Bar\n1,2");
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/missing required column\(s\): Date, Asset Pair, Amount/);
  });
});

describe("reconcileRows", () => {
  it("matches by hash and by pair, day and amount", () => {
    const result = reconcileRows(
      [row("1", { hash: "H1", date: "2025-03-01", amount: 5 }), row("2")],
      [tx("a", { source: { hash: "H1" }, amount: 5, timestamp: day(20) }), tx("b")]
    );
    expect(result.map((r) => [r.status, r.matchedTransactionId, r.basis])).toEqual([
      ["matched", "a", "hash"],
      ["matched", "b", "details"],
    ]);
  });

  it("marks rows with no candidate as unmatched", () => {
    const [r] = reconcileRows([row("1", { amount: 999 })], [tx("a")]);
    expect(r.status).toBe("unmatched");
    expect(r.candidates).toEqual([]);
  });

  it("never silently matches when several transactions fit", () => {
    const [r] = reconcileRows([row("1")], [tx("a"), tx("b")]);
    expect(r.status).toBe("ambiguous");
    expect(r.matchedTransactionId).toBeNull();
    expect(r.candidates.map((c) => c.transactionId)).toEqual(["a", "b"]);
  });

  it("treats rows competing for the same single transaction as ambiguous", () => {
    const result = reconcileRows([row("1"), row("2")], [tx("a")]);
    expect(result.map((r) => r.status)).toEqual(["ambiguous", "ambiguous"]);
  });

  it("treats a hash shared by several transactions as ambiguous", () => {
    const [r] = reconcileRows([row("1", { hash: "H" })], [tx("a", { source: { hash: "H" } }), tx("b", { source: { hash: "H" } })]);
    expect(r.status).toBe("ambiguous");
  });

  it("compares amounts with a tiny tolerance and pairs case-insensitively", () => {
    const [r] = reconcileRows([row("1", { assetPair: "xlm/usdc", amount: 100.00000001 })], [tx("a")]);
    expect(r.status).toBe("matched");
  });
});

describe("applyDecisions", () => {
  const ambiguous = () => reconcileRows([row("1")], [tx("a"), tx("b")]);

  it("keeps an ambiguous row ambiguous even when only one candidate remains", () => {
    const [r] = applyDecisions(ambiguous(), { "1": { dismissed: ["b"] } });
    expect(r.status).toBe("ambiguous");
    expect(r.candidates.map((c) => c.transactionId)).toEqual(["a"]);
    expect(r.matchedTransactionId).toBeNull();
  });

  it("matches only after an explicit confirmation", () => {
    const [r] = applyDecisions(ambiguous(), { "1": { confirmed: "b" } });
    expect(r).toMatchObject({ status: "matched", basis: "confirmed", matchedTransactionId: "b" });
  });

  it("returns a row to unmatched when every candidate is dismissed, including a matched one", () => {
    const [x] = applyDecisions(ambiguous(), { "1": { dismissed: ["a", "b"] } });
    expect(x.status).toBe("unmatched");
    const single = reconcileRows([row("1")], [tx("a")]);
    expect(applyDecisions(single, { "1": { dismissed: ["a"] } })[0].status).toBe("unmatched");
  });

  it("leaves rows without decisions untouched and counts statuses", () => {
    const base = reconcileRows([row("1"), row("2", { amount: 9 })], [tx("a")]);
    const applied = applyDecisions(base, {});
    expect(applied).toEqual(base);
    expect(countByStatus(applied)).toEqual({ matched: 1, unmatched: 1, ambiguous: 0 });
  });
});
