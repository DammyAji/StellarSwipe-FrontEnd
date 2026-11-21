export interface TradeWalletOption {
  publicKey: string;
  nickname?: string;
}

/**
 * A saved default is only safe to preselect while it is still connected and
 * appears in the current wallet list. Otherwise the caller must ask the user.
 */
export function resolvePreferredTradeWallet(
  preferredPublicKey: string | null | undefined,
  wallets: readonly TradeWalletOption[],
  connected: boolean,
): string | null {
  if (!connected || !preferredPublicKey) return null;
  return wallets.some((wallet) => wallet.publicKey === preferredPublicKey)
    ? preferredPublicKey
    : null;
}

export function isTradeWalletEligible(
  publicKey: string | null | undefined,
  wallets: readonly TradeWalletOption[],
  connected: boolean,
): publicKey is string {
  return Boolean(
    connected &&
      publicKey &&
      wallets.some((wallet) => wallet.publicKey === publicKey),
  );
}
