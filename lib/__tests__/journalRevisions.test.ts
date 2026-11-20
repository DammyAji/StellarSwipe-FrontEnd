import {
  appendRevision,
  diffRevisions,
  hasComparableHistory,
  MAX_REVISIONS_PER_ENTRY,
  snapshotEntry,
} from "@/lib/journalRevisions";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

const base: TransactionHistoryItem = {
  id: "tx-1",
  hash: "manual-1",
  assetPair: "XLM/USDC",
  amount: "10",
  price: "0.5",
  fee: "0",
  token: "XLM",
  timestamp: 1_700_000_000_000,
  type: "MANUAL",
  status: "SUCCEEDED",
  outcome: "PENDING",
  tags: ["dca"],
};

describe("appendRevision", () => {
  it("creates a baseline for an entry seen for the first time", () => {
    const list = appendRevision(undefined, base, 1000);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ version: 1, source: "baseline", capturedAt: 1000 });
    expect(hasComparableHistory(list)).toBe(false);
  });

  it("returns the same list when nothing tracked changed", () => {
    const first = appendRevision(undefined, base, 1000);
    const again = appendRevision(first, { ...base, revision: 5, archivedAt: 99 }, 2000);
    expect(again).toBe(first);
  });

  it("records an edit as a new version", () => {
    const first = appendRevision(undefined, base, 1000);
    const second = appendRevision(first, { ...base, amount: "12", tags: ["dca", "breakout"] }, 2000);
    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({ version: 2, source: "edit", capturedAt: 2000 });
    expect(hasComparableHistory(second)).toBe(true);
  });

  it("keeps at most the newest versions", () => {
    let list = appendRevision(undefined, base, 0);
    for (let i = 1; i <= MAX_REVISIONS_PER_ENTRY + 5; i++) {
      list = appendRevision(list, { ...base, amount: String(100 + i) }, i);
    }
    expect(list).toHaveLength(MAX_REVISIONS_PER_ENTRY);
    expect(list[list.length - 1].fields.amount).toBe(String(100 + MAX_REVISIONS_PER_ENTRY + 5));
  });
});

describe("diffRevisions", () => {
  it("lists only the changed fields with before and after values", () => {
    const a = appendRevision(undefined, base, 1000);
    const b = appendRevision(a, { ...base, amount: "12", outcome: "WIN", tags: ["dca", "breakout"] }, 2000);
    expect(diffRevisions(b[0], b[1])).toEqual([
      { field: "amount", label: "Amount", before: "10", after: "12" },
      { field: "outcome", label: "Outcome", before: "PENDING", after: "WIN" },
      { field: "tags", label: "Tags", before: "dca", after: "dca, breakout" },
    ]);
  });

  it("reports nothing for identical versions", () => {
    const a = appendRevision(undefined, base, 1000);
    expect(diffRevisions(a[0], a[0])).toEqual([]);
  });
});

describe("snapshotEntry", () => {
  it("normalizes missing values to empty strings", () => {
    expect(snapshotEntry({ ...base, tags: undefined }).tags).toBe("");
    expect(snapshotEntry(base).notes).toBe("");
  });
});
