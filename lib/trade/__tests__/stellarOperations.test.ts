/**
 * Unit tests for the Stellar operation summariser (#1104).
 *
 * Each test feeds a plain-JS operation object (the shape returned by the
 * stellar-sdk after deserialising a transaction) through summariseOperation
 * and asserts the display-ready row it produces.
 */

import {
  summariseOperation,
  summariseOperations,
  formatAsset,
  type OperationRow,
} from "@/lib/trade/stellarOperations";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const NATIVE = { code: "XLM" };
const USDC = { code: "USDC", issuer: ISSUER };

// ── formatAsset ───────────────────────────────────────────────────────────────

describe("formatAsset", () => {
  it("returns code only for the native asset", () => {
    expect(formatAsset({ code: "XLM", issuer: null })).toBe("XLM");
  });

  it("appends a truncated issuer for issued assets", () => {
    expect(formatAsset({ code: "USDC", issuer: ISSUER })).toMatch(
      /^USDC \(GA5ZSEJY…\)$/
    );
  });

  it("does not truncate short issuers", () => {
    expect(formatAsset({ code: "FOO", issuer: "GABC1234" })).toBe(
      "FOO (GABC1234)"
    );
  });
});

// ── payment ───────────────────────────────────────────────────────────────────

describe("payment operation", () => {
  it("maps to a known row with label Payment", () => {
    const row = summariseOperation({
      type: "payment",
      destination: "GDEST",
      asset: USDC,
      amount: "50.0000000",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Payment");
    expect(row.asset.code).toBe("USDC");
    expect(row.asset.issuer).toBe(ISSUER);
    expect(row.amount).toBe("50.0000000");
    expect(row.destAsset).toBeUndefined();
  });

  it("handles native XLM payment", () => {
    const row = summariseOperation({
      type: "payment",
      destination: "GDEST",
      asset: NATIVE,
      amount: "10.0000000",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.asset.code).toBe("XLM");
    expect(row.asset.issuer).toBeNull();
  });
});

// ── pathPaymentStrictSend ─────────────────────────────────────────────────────

describe("pathPaymentStrictSend operation", () => {
  it("maps send and dest assets with correct label", () => {
    const row = summariseOperation({
      type: "pathPaymentStrictSend",
      sendAsset: NATIVE,
      sendAmount: "100.0000000",
      destination: "GDEST",
      destAsset: USDC,
      destMin: "9.5000000",
      path: [],
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Path payment (exact send)");
    expect(row.asset.code).toBe("XLM");
    expect(row.amount).toBe("100.0000000");
    expect(row.destAsset?.code).toBe("USDC");
    expect(row.destAmount).toBe("9.5000000");
  });
});

// ── pathPaymentStrictReceive ──────────────────────────────────────────────────

describe("pathPaymentStrictReceive operation", () => {
  it("maps send max and dest amount with correct label", () => {
    const row = summariseOperation({
      type: "pathPaymentStrictReceive",
      sendAsset: NATIVE,
      sendMax: "110.0000000",
      destination: "GDEST",
      destAsset: USDC,
      destAmount: "10.0000000",
      path: [],
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Path payment (exact receive)");
    expect(row.asset.code).toBe("XLM");
    expect(row.amount).toBe("110.0000000");
    expect(row.destAsset?.code).toBe("USDC");
    expect(row.destAmount).toBe("10.0000000");
  });
});

// ── manageSellOffer ───────────────────────────────────────────────────────────

describe("manageSellOffer operation", () => {
  it("labels a new offer (offerId === '0')", () => {
    const row = summariseOperation({
      type: "manageSellOffer",
      selling: NATIVE,
      buying: USDC,
      amount: "50.0000000",
      price: "0.1",
      offerId: "0",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Create sell offer");
    expect(row.asset.code).toBe("XLM");
    expect(row.destAsset?.code).toBe("USDC");
  });

  it("labels an existing offer update (non-zero offerId)", () => {
    const row = summariseOperation({
      type: "manageSellOffer",
      selling: NATIVE,
      buying: USDC,
      amount: "50.0000000",
      price: "0.1",
      offerId: "12345",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Update sell offer");
  });
});

// ── manageBuyOffer ────────────────────────────────────────────────────────────

describe("manageBuyOffer operation", () => {
  it("maps buying asset and buyAmount", () => {
    const row = summariseOperation({
      type: "manageBuyOffer",
      selling: NATIVE,
      buying: USDC,
      buyAmount: "50.0000000",
      price: "0.1",
      offerId: "0",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Create buy offer");
    expect(row.asset.code).toBe("USDC");
    expect(row.amount).toBe("50.0000000");
    expect(row.destAsset?.code).toBe("XLM");
  });
});

// ── changeTrust ───────────────────────────────────────────────────────────────

describe("changeTrust operation", () => {
  it("labels adding a trustline", () => {
    const row = summariseOperation({
      type: "changeTrust",
      line: USDC,
      limit: "922337203685.4775807",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Add trustline");
    expect(row.asset.code).toBe("USDC");
    expect(row.amount).toBeNull();
  });

  it("labels removing a trustline (limit === '0')", () => {
    const row = summariseOperation({
      type: "changeTrust",
      line: USDC,
      limit: "0",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Remove trustline");
  });
});

// ── createAccount ─────────────────────────────────────────────────────────────

describe("createAccount operation", () => {
  it("maps starting balance", () => {
    const row = summariseOperation({
      type: "createAccount",
      destination: "GNEW",
      startingBalance: "1.0000000",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Create account");
    expect(row.asset.code).toBe("XLM");
    expect(row.amount).toBe("1.0000000");
  });
});

// ── createPassiveSellOffer ────────────────────────────────────────────────────

describe("createPassiveSellOffer operation", () => {
  it("maps selling asset and amount", () => {
    const row = summariseOperation({
      type: "createPassiveSellOffer",
      selling: NATIVE,
      buying: USDC,
      amount: "25.0000000",
      price: "0.1",
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Create passive sell offer");
    expect(row.asset.code).toBe("XLM");
    expect(row.destAsset?.code).toBe("USDC");
  });
});

// ── invokeHostFunction ────────────────────────────────────────────────────────

describe("invokeHostFunction operation", () => {
  it("surfaces a known row without hiding it", () => {
    const row = summariseOperation({
      type: "invokeHostFunction",
      func: {},
      auth: [],
    });
    expect(row.kind).toBe("known");
    if (row.kind !== "known") return;
    expect(row.label).toBe("Invoke contract function");
    // Amount is not applicable.
    expect(row.amount).toBeNull();
  });
});

// ── unknown / unexpected operation types ─────────────────────────────────────

describe("unknown operation", () => {
  it("surfaces the type as an unknown row, not silently drops it", () => {
    const row = summariseOperation({
      type: "someFutureOpType",
    });
    expect(row.kind).toBe("unknown");
    if (row.kind !== "unknown") return;
    expect(row.type).toBe("someFutureOpType");
  });

  it("treats a missing type field as unknown", () => {
    const row = summariseOperation({});
    expect(row.kind).toBe("unknown");
    if (row.kind !== "unknown") return;
    expect(row.type).toBe("unknown");
  });
});

// ── summariseOperations (batch) ───────────────────────────────────────────────

describe("summariseOperations", () => {
  it("maps an array of operations preserving order", () => {
    const ops = [
      { type: "payment", asset: NATIVE, amount: "10.0000000", destination: "GDEST" },
      { type: "changeTrust", line: USDC, limit: "922337203685.4775807" },
    ];
    const rows = summariseOperations(ops);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("known");
    expect((rows[0] as OperationRow & { kind: "known" }).label).toBe("Payment");
    expect(rows[1].kind).toBe("known");
    expect((rows[1] as OperationRow & { kind: "known" }).label).toBe(
      "Add trustline"
    );
  });

  it("returns an empty array for an empty input", () => {
    expect(summariseOperations([])).toEqual([]);
  });

  it("handles mixed known and unknown operations", () => {
    const ops = [
      { type: "payment", asset: NATIVE, amount: "5.0000000", destination: "G" },
      { type: "futureOpXYZ" },
    ];
    const rows = summariseOperations(ops);
    expect(rows[0].kind).toBe("known");
    expect(rows[1].kind).toBe("unknown");
  });
});
