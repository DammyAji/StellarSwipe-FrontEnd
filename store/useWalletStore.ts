import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUDIT_ACTIONS, recordAuditEntry } from "@/services/auditTrail";

export interface Wallet {
  publicKey: string;
  /** User-assigned label. Display only — never replaces the address. */
  nickname?: string;
}

export const NICKNAME_MAX_LENGTH = 32;

/**
 * Normalises a user-entered nickname: trims, collapses whitespace and caps the
 * length. Returns `undefined` for empty input so the nickname is cleared.
 */
export function normalizeNickname(raw: string): string | undefined {
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

interface WalletState {
  wallets: Wallet[];
  activePublicKey: string | null;
  /** Saved default for new trades; may be unavailable while disconnected. */
  defaultTradeWalletPublicKey: string | null;
  /** Active wallet key — kept for backward compatibility */
  publicKey: string | null;
  isConnected: boolean;
  network: string;
  addWallet: (key: string) => void;
  setActiveWallet: (key: string) => void;
  setDefaultTradeWallet: (key: string | null) => void;
  removeWallet: (key: string) => void;
  /** Set, edit or clear (empty string) the nickname of a connected wallet. */
  setWalletNickname: (key: string, nickname: string) => void;
  disconnectAll: () => void;
  setNetwork: (network: string) => void;
  /** Backward compat: setPublicKey adds a wallet (or disconnects on null) */
  setPublicKey: (key: string | null) => void;
  /** Backward compat: setConnected(false) disconnects the active wallet */
  setConnected: (connected: boolean) => void;
  /** Backward compat: disconnect removes the active wallet */
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      wallets: [],
      activePublicKey: null,
      defaultTradeWalletPublicKey: null,
      publicKey: null,
      isConnected: false,
      network: "TESTNET",

      addWallet: (key) =>
        set((state) => {
          if (state.wallets.some((w) => w.publicKey === key)) {
            return { activePublicKey: key, publicKey: key, isConnected: true };
          }
          // Sensitive account change — audit the new wallet (public keys are
          // not secrets).
          recordAuditEntry({
            actor: key,
            action: AUDIT_ACTIONS.WALLET_CONNECTED,
            target: key,
            metadata: { network: state.network },
          });
          const wallets = [...state.wallets, { publicKey: key }];
          return {
            wallets,
            activePublicKey: key,
            publicKey: key,
            isConnected: true,
          };
        }),

      setActiveWallet: (key) =>
        set((state) => {
          if (!state.wallets.some((w) => w.publicKey === key)) return {};
          return { activePublicKey: key, publicKey: key };
        }),

      setDefaultTradeWallet: (key) =>
        set((state) => {
          if (
            key !== null &&
            (!state.isConnected ||
              !state.wallets.some((wallet) => wallet.publicKey === key))
          ) {
            return {};
          }
          return { defaultTradeWalletPublicKey: key };
        }),

      setWalletNickname: (key, nickname) =>
        set((state) => {
          if (!state.wallets.some((w) => w.publicKey === key)) return {};
          const normalized = normalizeNickname(nickname);
          return {
            wallets: state.wallets.map((w) =>
              w.publicKey === key
                ? normalized
                  ? { ...w, nickname: normalized }
                  : { publicKey: w.publicKey }
                : w
            ),
          };
        }),

      removeWallet: (key) =>
        set((state) => {
          // Sensitive account change — audit the removal.
          recordAuditEntry({
            actor: key,
            action: AUDIT_ACTIONS.WALLET_DISCONNECTED,
            target: key,
          });
          const wallets = state.wallets.filter((w) => w.publicKey !== key);
          const activePublicKey =
            state.activePublicKey === key
              ? wallets[0]?.publicKey ?? null
              : state.activePublicKey;
          return {
            wallets,
            activePublicKey,
            publicKey: activePublicKey,
            isConnected: wallets.length > 0,
          };
        }),

      disconnectAll: () =>
        set((state) => {
          // Sensitive account change — audit each removed wallet.
          for (const wallet of state.wallets) {
            recordAuditEntry({
              actor: wallet.publicKey,
              action: AUDIT_ACTIONS.WALLET_DISCONNECTED,
              target: wallet.publicKey,
            });
          }
          return {
            wallets: [],
            activePublicKey: null,
            publicKey: null,
            isConnected: false,
          };
        }),

      setNetwork: (network) => set({ network: network.toUpperCase() }),

      // Backward compat: setPublicKey adds wallet and makes it active
      setPublicKey: (key) => {
        if (key === null) {
          get().disconnect();
        } else {
          get().addWallet(key);
        }
      },

      // Backward compat: setConnected(false) disconnects active
      setConnected: (connected) => {
        if (!connected) get().disconnect();
      },

      // Backward compat: disconnect removes the active wallet
      disconnect: () =>
        set((state) => {
          const key = state.activePublicKey;
          if (!key) return {};
          // Sensitive account change — audit the removal.
          recordAuditEntry({
            actor: key,
            action: AUDIT_ACTIONS.WALLET_DISCONNECTED,
            target: key,
          });
          const wallets = state.wallets.filter((w) => w.publicKey !== key);
          const activePublicKey = wallets[0]?.publicKey ?? null;
          return {
            wallets,
            activePublicKey,
            publicKey: activePublicKey,
            isConnected: wallets.length > 0,
          };
        }),
    }),
    { name: "wallet-store" }
  )
);
