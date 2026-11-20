import { summarizeByCategory, UNCATEGORIZED_LABEL } from "@/lib/taxCategorySummary";
import { computeTaxReport, type TaxableTransaction } from "@/lib/taxUtils";

const ts = new Date(2025, 5, 1).getTime();
const tx = (id: string, type: string | undefined, sellPrice = 12, buyPrice = 10): TaxableTransaction => ({
  id,
  assetPair: "XLM/USDC",
  amount: 10,
  buyPrice,
  sellPrice,
  fee: 1,
  timestamp: ts,
  source: type ? { hash: `hash-${id}`, type } : undefined,
});

describe("summarizeByCategory", () => {
  const txs = [tx("t1", "COPY_TRADE"), tx("t2", "SWAP", 9), tx("m1", "MANUAL"), tx("m2", "MANUAL", 14)];
  const report = computeTaxReport(txs, 2025, "US");
  const byId = new Map(txs.map((t) => [t.id, t]));

  it("groups lines by category with counts and totals that reconcile to the report", () => {
    const summary = summarizeByCategory(report.entries, byId, {}, report.totalGainLoss);
    expect(summary.groups.map((g) => [g.category, g.count])).toEqual([
      ["trade", 2],
      ["uncategorized", 2],
    ]);
    expect(summary.totals.count).toBe(report.entries.length);
    expect(summary.totals.gainLoss).toBeCloseTo(report.totalGainLoss, 9);
    expect(summary.reconciles).toBe(true);
    expect(summary.gainLossDifference).toBe(0);
  });

  it("keeps unsupported or unresolved rows visible in their own group with their lines", () => {
    const summary = summarizeByCategory(report.entries, byId, { m1: "unresolved" });
    const group = summary.groups.find((g) => g.category === "uncategorized")!;
    expect(group.label).toBe(UNCATEGORIZED_LABEL);
    expect(group.lines.map((l) => l.id).sort()).toEqual(["m1", "m2"]);
  });

  it("uses manual assignments and exposes the contributing lines of each group", () => {
    const summary = summarizeByCategory(report.entries, byId, { m1: "income", m2: "income" });
    expect(summary.groups.map((g) => g.category)).toEqual(["trade", "income"]);
    const income = summary.groups.find((g) => g.category === "income")!;
    expect(income.count).toBe(2);
    expect(income.lines.map((l) => l.id)).toEqual(["m1", "m2"]);
    expect(income.gainLoss).toBeCloseTo(income.lines.reduce((s, l) => s + l.gainLoss, 0), 9);
  });

  it("puts lines whose source transaction is missing in the uncategorized group", () => {
    const summary = summarizeByCategory(report.entries, new Map(), {});
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0].category).toBe("uncategorized");
    expect(summary.groups[0].count).toBe(report.entries.length);
  });

  it("reports a mismatch instead of hiding it", () => {
    const summary = summarizeByCategory(report.entries, byId, {}, report.totalGainLoss + 5);
    expect(summary.reconciles).toBe(false);
    expect(summary.gainLossDifference).toBeCloseTo(-5, 9);
  });

  it("handles an empty report", () => {
    const summary = summarizeByCategory([], new Map(), {});
    expect(summary.groups).toEqual([]);
    expect(summary.reconciles).toBe(true);
  });
});
