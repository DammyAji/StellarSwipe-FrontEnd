import {
  buildJournalDraftFromTransaction,
  findJournalEntryByHash,
  isOnChainHash,
  planJournalDraft,
  transactionKey,
} from "@/lib/journalFromTransaction";
import type { TransactionDetails, TransactionHistoryItem } from "@/store/useTransactionStore";

const HASH = "b3f9c18e6b7a4cd81d2f3a9ed7f8c6b9f2d7a1b3c4e5f6a7b8c9d0e1f2a3b4c";

const tx: TransactionDetails = {
  hash: HASH,
  amount: "120",
  price: "0.4821",
  fee: "0.0004",
  token: "XLM",
  timestamp: Date.UTC(2025, 2, 14, 12, 0, 0),
  network: "TESTNET",
};

function entry(overrides: Partial<TransactionHistoryItem> = {}): TransactionHistoryItem {
  return {
    ...tx,
    id: "tx-1",
    assetPair: "XLM/USDC",
    type: "COPY_TRADE",
    status: "SUCCEEDED",
    outcome: "WIN",
    ...overrides,
  };
}

describe("isOnChainHash", () => {
  it("accepts real hashes and rejects journal placeholders", () => {
    expect(isOnChainHash(HASH)).toBe(true);
    expect(isOnChainHash("manual-18f3a")).toBe(false);
    expect(isOnChainHash("csv-18f3a1b2c3d4e5f6")).toBe(false);
    expect(isOnChainHash("")).toBe(false);
    expect(isOnChainHash(undefined)).toBe(false);
  });
});

describe("buildJournalDraftFromTransaction", () => {
  it("carries known values and reports what the transaction did not provide", () => {
    const result = buildJournalDraftFromTransaction(tx);
    expect(result.draft).toMatchObject({
      date: "2025-03-14",
      amount: "120",
      price: "0.4821",
      fee: "0.0004",
      token: "XLM",
      status: "SUCCEEDED",
    });
    expect(result.draft.assetPair).toBeUndefined();
    expect(result.draft.type).toBeUndefined();
    expect(result.missing).toEqual(expect.arrayContaining(["asset pair", "trade type"]));
    expect(result.linkedHash).toBe(HASH);
    expect(result.linkedNetwork).toBe("TESTNET");
    expect(result.context.map((c) => c.label)).toEqual(["Transaction", "Network"]);
  });

  it("does not invent values for missing or invalid fields", () => {
    const result = buildJournalDraftFromTransaction({ ...tx, price: "", amount: "abc", fee: "-1", hash: "" });
    expect(result.draft.price).toBeUndefined();
    expect(result.draft.amount).toBeUndefined();
    expect(result.draft.fee).toBeUndefined();
    expect(result.missing).toEqual(expect.arrayContaining(["amount", "price", "fee"]));
    expect(result.linkedHash).toBeNull();
  });

  it("carries asset pair, type and outcome from an existing history item", () => {
    const result = buildJournalDraftFromTransaction(entry());
    expect(result.draft).toMatchObject({ assetPair: "XLM/USDC", type: "COPY_TRADE", outcome: "WIN" });
    expect(result.missing).toEqual([]);
  });
});

describe("planJournalDraft", () => {
  it("starts a new draft when nothing exists yet", () => {
    const plan = planJournalDraft(tx, [], null);
    expect(plan.status).toBe("new");
  });

  it("reuses an existing entry for the same hash instead of creating a duplicate", () => {
    const plan = planJournalDraft(tx, [entry({ id: "tx-existing" })], null);
    expect(plan).toEqual({ status: "exists", entryId: "tx-existing" });
  });

  it("does not queue the same transaction twice", () => {
    expect(planJournalDraft(tx, [], transactionKey(tx)).status).toBe("already-queued");
    expect(planJournalDraft(tx, [], "hash:other").status).toBe("new");
  });

  it("falls back to a signature key when the transaction has no hash", () => {
    const noHash = { ...tx, hash: "" };
    expect(transactionKey(noHash)).toMatch(/^sig:/);
    expect(planJournalDraft(noHash, [], transactionKey(noHash)).status).toBe("already-queued");
  });
});

describe("findJournalEntryByHash", () => {
  it("returns null for empty hashes", () => {
    expect(findJournalEntryByHash([entry()], "")).toBeNull();
    expect(findJournalEntryByHash([entry()], null)).toBeNull();
  });
});
