import { describeLinkedExecution } from "@/lib/journalLinkedDetails";
import type { TransactionHistoryItem } from "@/store/useTransactionStore";

const HASH = "b3f9c18e6b7a4cd81d2f3a9ed7f8c6b9f2d7a1b3c4e5f6a7b8c9d0e1f2a3b4c";

const linked: TransactionHistoryItem = {
  id: "tx-1",
  hash: HASH,
  assetPair: "XLM/USDC",
  amount: "120",
  price: "0.4821",
  fee: "0.0004",
  token: "XLM",
  timestamp: Date.UTC(2025, 2, 14),
  type: "COPY_TRADE",
  status: "SUCCEEDED",
  outcome: "WIN",
  network: "PUBLIC",
};

describe("describeLinkedExecution", () => {
  it("shows concise context and a receipt link for linked entries", () => {
    const d = describeLinkedExecution(linked);
    expect(d.linked).toBe(true);
    expect(d.receiptUrl).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
    expect(d.rows.find((r) => r.label === "Amount")?.value).toBe("120 XLM");
    expect(d.rows.find((r) => r.label === "Network")?.value).toBe("Mainnet");
    expect(d.networkNote).toBeNull();
  });

  it("keeps user notes separate from execution details", () => {
    const d = describeLinkedExecution({ ...linked, notes: "  breakout retest  " });
    expect(d.notes).toBe("breakout retest");
    expect(d.rows.some((r) => r.value.includes("breakout"))).toBe(false);
  });

  it("marks unknown values unavailable and explains the fallback network", () => {
    const d = describeLinkedExecution({ ...linked, network: undefined, price: "" }, "testnet");
    expect(d.rows.find((r) => r.label === "Network")).toMatchObject({ value: "Unavailable", available: false });
    expect(d.rows.find((r) => r.label === "Price")).toMatchObject({ available: false });
    expect(d.receiptUrl).toContain("/explorer/testnet/tx/");
    expect(d.networkNote).toContain("did not record a network");
  });

  it("warns that pending executions may still change", () => {
    expect(describeLinkedExecution({ ...linked, status: "PENDING" }).statusNote).toContain("Awaiting confirmation");
    expect(describeLinkedExecution(linked).statusNote).toBeNull();
  });

  it("leaves unlinked entries clean with no receipt", () => {
    for (const hash of ["manual-18f3a2b1c4d5e6f7", "csv-18f3a2b1c4d5e6f7", ""]) {
      const d = describeLinkedExecution({ ...linked, hash, notes: "n" });
      expect(d.linked).toBe(false);
      expect(d.receiptUrl).toBeNull();
      expect(d.rows).toEqual([]);
      expect(d.notes).toBe("n");
    }
  });
});
