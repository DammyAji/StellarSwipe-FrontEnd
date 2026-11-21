import {
  isTradeWalletEligible,
  resolvePreferredTradeWallet,
} from "@/lib/tradeWalletSelection";

const WALLET_A = "GA";
const WALLET_B = "GB";
const WALLETS = [{ publicKey: WALLET_A }, { publicKey: WALLET_B }];

describe("trade wallet preference", () => {
  it("preselects the saved account when it is connected and eligible", () => {
    expect(resolvePreferredTradeWallet(WALLET_B, WALLETS, true)).toBe(WALLET_B);
  });

  it("does not preselect a saved account while disconnected", () => {
    expect(resolvePreferredTradeWallet(WALLET_B, WALLETS, false)).toBeNull();
  });

  it("does not preselect an account that is no longer connected", () => {
    expect(resolvePreferredTradeWallet(WALLET_B, [WALLETS[0]!], true)).toBeNull();
  });

  it("does not preselect when no default has been saved", () => {
    expect(resolvePreferredTradeWallet(null, WALLETS, true)).toBeNull();
  });

  it("validates a per-trade choice against current connected accounts", () => {
    expect(isTradeWalletEligible(WALLET_A, WALLETS, true)).toBe(true);
    expect(isTradeWalletEligible(WALLET_B, WALLETS, false)).toBe(false);
    expect(isTradeWalletEligible("GC", WALLETS, true)).toBe(false);
    expect(isTradeWalletEligible(null, WALLETS, true)).toBe(false);
  });
});
