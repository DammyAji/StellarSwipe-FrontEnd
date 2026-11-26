// Wallet connection utilities for StellarSwipe.
// Supports Freighter and Albedo wallets with localStorage persistence.

export type WalletType = 'freighter' | 'albedo';

export interface WalletState {
  connected: boolean;
  walletType: WalletType | null;
  publicKey: string | null;
}

const STORAGE_KEY = 'stellarswipe.wallet';

export const EMPTY_WALLET_STATE: WalletState = {
  connected: false,
  walletType: null,
  publicKey: null,
};

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

/** Truncate a Stellar public key, e.g. GABC...XYZ. */
export function truncatePublicKey(publicKey: string): string {
  if (!publicKey) return '';
  if (publicKey.length <= 10) return publicKey;
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Persist wallet state to localStorage. */
export function saveWalletState(state: WalletState): void {
  if (!isBrowser()) return;
  try {
    if (state.connected && state.publicKey && state.walletType) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (e.g. private mode / quota).
  }
}

/** Load persisted wallet state from localStorage. */
export function loadWalletState(): WalletState {
  if (!isBrowser()) return { ...EMPTY_WALLET_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_WALLET_STATE };
    const parsed = JSON.parse(raw) as Partial<WalletState>;
    if (
      parsed &&
      parsed.connected &&
      typeof parsed.publicKey === 'string' &&
      (parsed.walletType === 'freighter' || parsed.walletType === 'albedo')
    ) {
      return {
        connected: true,
        walletType: parsed.walletType,
        publicKey: parsed.publicKey,
      };
    }
  } catch {
    // Corrupt storage — fall through to empty state.
  }
  return { ...EMPTY_WALLET_STATE };
}

/** Clear persisted wallet state. */
export function clearWalletState(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

interface FreighterApi {
  isConnected?: () => Promise<{ isConnected: boolean }>;
  requestAccess?: () => Promise<{ address?: string; error?: string }>;
  getPublicKey?: () => Promise<string>;
}

interface AlbedoApi {
  publicKey: (params?: Record<string, unknown>) => Promise<{ pubkey?: string }>;
}

function getFreighter(): FreighterApi | null {
  if (!isBrowser()) return null;
  const w = window as unknown as { freighter?: FreighterApi };
  return w.freighter ?? null;
}

function getAlbedo(): AlbedoApi | null {
  if (!isBrowser()) return null;
  const w = window as unknown as { albedo?: AlbedoApi };
  return w.albedo ?? null;
}

async function connectFreighter(): Promise<string> {
  const freighter = getFreighter();
  if (!freighter) {
    throw new WalletError(
      'Freighter wallet extension is not installed. Please install it to continue.',
    );
  }
  try {
    if (freighter.requestAccess) {
      const result = await freighter.requestAccess();
      if (result?.error) {
        throw new WalletError(result.error);
      }
      if (result?.address) return result.address;
    }
    if (freighter.getPublicKey) {
      const key = await freighter.getPublicKey();
      if (key) return key;
    }
    throw new WalletError('Unable to retrieve public key from Freighter.');
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError(
      'Freighter connection was rejected or failed. Please try again.',
    );
  }
}

async function connectAlbedo(): Promise<string> {
  const albedo = getAlbedo();
  if (!albedo) {
    throw new WalletError(
      'Albedo wallet is not available. Please install the Albedo extension or use the web wallet.',
    );
  }
  try {
    const result = await albedo.publicKey({} as Record<string, unknown>);
    if (result?.pubkey) return result.pubkey;
    throw new WalletError('Unable to retrieve public key from Albedo.');
  } catch (err) {
    if (err instanceof WalletError) throw err;
    throw new WalletError(
      'Albedo connection was rejected or failed. Please try again.',
    );
  }
}

/**
 * Connect to the given wallet and return the resulting wallet state.
 * Throws a WalletError with a user-friendly message on failure.
 */
export async function connectWallet(walletType: WalletType): Promise<WalletState> {
  const publicKey =
    walletType === 'freighter'
      ? await connectFreighter()
      : await connectAlbedo();

  const state: WalletState = {
    connected: true,
    walletType,
    publicKey,
  };
  saveWalletState(state);
  return state;
}

/** Disconnect the current wallet and clear persisted state. */
export function disconnectWallet(): WalletState {
  clearWalletState();
  return { ...EMPTY_WALLET_STATE };
}
