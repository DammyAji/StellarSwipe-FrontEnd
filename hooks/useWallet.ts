'use client';

import { useCallback, useEffect, useState } from 'react';

export type WalletType = 'freighter' | 'albedo';

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  walletType: WalletType | null;
  error: string | null;
  connecting: boolean;
}

const STORAGE_KEY = 'stellarswipe.wallet';

interface PersistedWallet {
  publicKey: string;
  walletType: WalletType;
}

function truncateKey(publicKey: string): string {
  if (publicKey.length <= 10) return publicKey;
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

function readPersisted(): PersistedWallet | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWallet;
    if (!parsed?.publicKey || !parsed?.walletType) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(value: PersistedWallet | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

async function connectFreighter(): Promise<string> {
  const freighter = (window as unknown as { freighter?: { requestAccess?: () => Promise<{ error?: string }>; getPublicKey?: () => Promise<string> } }).freighter;
  if (!freighter) {
    throw new Error('Freighter wallet is not installed. Please install the Freighter extension.');
  }
  if (typeof freighter.requestAccess === 'function') {
    const access = await freighter.requestAccess();
    if (access?.error) {
      throw new Error('Connection request was rejected.');
    }
  }
  if (typeof freighter.getPublicKey !== 'function') {
    throw new Error('Freighter wallet is not available.');
  }
  const publicKey = await freighter.getPublicKey();
  if (!publicKey) {
    throw new Error('Connection request was rejected.');
  }
  return publicKey;
}

async function connectAlbedo(): Promise<string> {
  const albedo = (window as unknown as { albedo?: { publicKey?: (opts?: { token?: string }) => Promise<{ pubkey?: string }> } }).albedo;
  if (!albedo || typeof albedo.publicKey !== 'function') {
    throw new Error('Albedo wallet is not available. Please try again.');
  }
  try {
    const result = await albedo.publicKey({ token: 'stellarswipe' });
    if (!result?.pubkey) {
      throw new Error('Connection request was rejected.');
    }
    return result.pubkey;
  } catch (err) {
    if (err instanceof Error && err.message === 'Connection request was rejected.') {
      throw err;
    }
    throw new Error('Connection request was rejected.');
  }
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    publicKey: null,
    walletType: null,
    error: null,
    connecting: false,
  });

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted) {
      setState({
        connected: true,
        publicKey: persisted.publicKey,
        walletType: persisted.walletType,
        error: null,
        connecting: false,
      });
    }
  }, []);

  const connect = useCallback(async (walletType: WalletType) => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));
    try {
      const publicKey = walletType === 'freighter' ? await connectFreighter() : await connectAlbedo();
      writePersisted({ publicKey, walletType });
      setState({
        connected: true,
        publicKey,
        walletType,
        error: null,
        connecting: false,
      });
      return publicKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet.';
      setState({
        connected: false,
        publicKey: null,
        walletType: null,
        error: message,
        connecting: false,
      });
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    writePersisted(null);
    setState({
      connected: false,
      publicKey: null,
      walletType: null,
      error: null,
      connecting: false,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    truncatedPublicKey: state.publicKey ? truncateKey(state.publicKey) : null,
    connect,
    disconnect,
    clearError,
  };
}

export default useWallet;
