import {
  generateJournalExport,
  JOURNAL_EXPORT_FIELDS,
  JOURNAL_EXPORT_SCHEMA,
  toExportEntry,
} from "@/lib/journalExport";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

const entry = (id: string, overrides: Partial<TransactionHistoryItem> = {}): TransactionHistoryItem => ({
  id,
  hash: `hash-${id}`,
  assetPair: "XLM/USDC",
  amount: "10",
  price: "0.5",
  fee: "0.01",
  token: "XLM",
  timestamp: Date.UTC(2025, 0, 2, 3, 4, 5),
  type: "SWAP",
  status: "SUCCEEDED",
  outcome: "WIN",
  tags: ["dca"],
  ...overrides,
});

const NOW = new Date(Date.UTC(2025, 5, 1, 12, 0, 0));

describe("generateJournalExport", () => {
  it("returns an explicit error for an empty selection", () => {
    expect(generateJournalExport([], NOW)).toEqual({
      ok: false,
      reason: "empty-selection",
      message: "Select at least one entry to export.",
    });
  });

  it("exports only the given entries as valid JSON with the documented fields", () => {
    const extras = { archivedAt: 5, notes: "n", pnl: 2.5 } as Partial<TransactionHistoryItem>;
    const result = generateJournalExport([entry("a"), entry("b", extras)], NOW);
    if (!result.ok) throw new Error("expected success");
    const doc = JSON.parse(result.json);
    expect(doc.schema).toBe(JOURNAL_EXPORT_SCHEMA);
    expect(doc.count).toBe(2);
    expect(doc.entries.map((e: { id: string }) => e.id)).toEqual(["a", "b"]);
    expect(doc.fields).toEqual(JOURNAL_EXPORT_FIELDS);
    expect(doc.entries[1]).toMatchObject({ archived: true, notes: "n", pnl: 2.5 });
    expect(result.filename).toBe("journal-export-2-entries-2025-06-01T12-00-00.json");
  });

  it("only includes documented fields and omits optional ones that are absent", () => {
    const exported = toExportEntry(entry("a", { revision: 3, pendingSync: true } as Partial<TransactionHistoryItem>));
    const documented = new Set(JOURNAL_EXPORT_FIELDS.map((f) => f.name));
    expect(Object.keys(exported).every((key) => documented.has(key))).toBe(true);
    expect("notes" in exported).toBe(false);
    expect("network" in exported).toBe(false);
    expect(exported.timestamp).toBe("2025-01-02T03:04:05.000Z");
  });

  it("reports a generation failure instead of throwing", () => {
    const broken = entry("a");
    // Tags are copied with a spread; a non-iterable value makes generation fail.
    (broken as unknown as { tags: unknown }).tags = { not: "iterable" };
    const result = generateJournalExport([broken], NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("generation-failed");
  });
});
