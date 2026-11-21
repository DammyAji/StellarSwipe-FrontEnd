"use client";

import { useState } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { useWalletStore } from "@/store/useWalletStore";
import { useActiveFlowsStore } from "@/store/useActiveFlowsStore";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";
import { walletToast } from "@/lib/walletToast";
import { traceWorker } from "@/src/tracing/worker-tracing.service";
import analyticsService from "@/services/analytics";
import { AUDIT_ACTIONS, recordAuditEntry } from "@/services/auditTrail";
import type { WalletConnectErrorReason } from "@/components/WalletConnectErrorModal";
import * as Sentry from "@sentry/nextjs";

const CONNECT_TIMEOUT_MS = 20000;
const CONNECT_TIMEOUT_MARKER = "wallet_connect_timeout";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(CONNECT_TIMEOUT_MARKER)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.message === CONNECT_TIMEOUT_MARKER;
}

function isUserRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancelled") ||
    msg.includes("canceled") ||
    msg.includes("declined") ||
    msg.includes("user rejected")
  );
}

export function useWallet() {
  const {
    publicKey,
    isConnected: connected,
    wallets,
    activePublicKey,
    setPublicKey,
    setConnected,
    disconnect,
    setActiveWallet,
    disconnectAll,
    setWalletNickname,
  } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [connectError, setConnectError] =
    useState<WalletConnectErrorReason>(null);

  function clearConnectError() {
    setConnectError(null);
  }

  async function connect() {
    try {
      setIsConnecting(true);
      setConnectError(null);
      const connectedResponse = await isConnected();
      if (!connectedResponse?.isConnected) {
        walletToast.notFound();
        setConnectError("not_found");
        analyticsService.track("wallet_connect_failed", {
          wallet_type: "freighter",
          reason: "not_found",
        });
        return;
      }
      await withTimeout(requestAccess(), CONNECT_TIMEOUT_MS);
      const result = await getAddress();
      const key = typeof result === "string" ? result : result.address;
      setPublicKey(key);
      setConnected(true);
      walletToast.connected(key);
      analyticsService.track("wallet_connected", {
        wallet_type: "freighter",
      });
      window.dispatchEvent(
        new CustomEvent("wallet-connected", { detail: { publicKey: key } })
      );
    } catch (err) {
      if (isUserRejection(err)) {
        walletToast.denied();
        analyticsService.track("wallet_connect_failed", {
          wallet_type: "freighter",
          reason: "user_rejected",
        });
      } else if (isTimeout(err)) {
        walletToast.timeout();
        setConnectError("timeout");
        analyticsService.track("wallet_connect_failed", {
          wallet_type: "freighter",
          reason: "timeout",
        });
      } else {
        walletToast.connectError();
        setConnectError("error");
        Sentry.captureException(err);
        analyticsService.track("wallet_connect_failed", {
          wallet_type: "freighter",
          reason: "error",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function sign(
    transactionXdr: string,
    networkPassphrase?: string
  ): Promise<string> {
    if (!connected || !publicKey) {
      throw new Error("Wallet not connected");
    }
    setIsSigning(true);
    const passphrase = networkPassphrase ?? NETWORK_PASSPHRASE;
    // A pending signature is network-bound; surface it to the network switch
    // confirmation (#800). It can't be cancelled from the app — the user
    // finishes or rejects it in the wallet.
    const flowId = `signing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    useActiveFlowsStore.getState().registerFlow({
      id: flowId,
      kind: "signing",
      label: "Transaction waiting for your wallet signature",
    });
    try {
      const result = await signTransaction(transactionXdr, {
        networkPassphrase: passphrase,
        address: publicKey,
      });
      // Sensitive action — audit it. Neither the XDR nor the resulting
      // signature is recorded.
      recordAuditEntry({
        actor: publicKey,
        action: AUDIT_ACTIONS.TRANSACTION_SIGNED,
        target: publicKey,
        metadata: { networkPassphrase: passphrase },
      });
      return typeof result === "string" ? result : result.signedTxXdr;
    } catch (err) {
      recordAuditEntry({
        actor: publicKey,
        action: AUDIT_ACTIONS.TRANSACTION_SIGN_FAILED,
        target: publicKey,
        metadata: {
          networkPassphrase: passphrase,
          reason: isUserRejection(err) ? "user_rejected" : "error",
        },
      });
      if (isUserRejection(err)) {
        walletToast.signingDenied();
        throw err;
      }
      walletToast.signError();
      Sentry.captureException(err);
      throw err;
    } finally {
      useActiveFlowsStore.getState().unregisterFlow(flowId);
      setIsSigning(false);
    }
  }

  async function connectAnother() {
    try {
      setIsConnecting(true);
      setConnectError(null);
      const connectedResponse = await isConnected();
      if (!connectedResponse?.isConnected) {
        walletToast.notFound();
        setConnectError("not_found");
        return;
      }
      await withTimeout(requestAccess(), CONNECT_TIMEOUT_MS);
      const result = await getAddress();
      const key = typeof result === "string" ? result : result.address;
      setPublicKey(key);
      walletToast.connected(key);
      analyticsService.track("wallet_connected", { wallet_type: "freighter" });
      window.dispatchEvent(
        new CustomEvent("wallet-connected", { detail: { publicKey: key } })
      );
    } catch (err) {
      if (isUserRejection(err)) {
        walletToast.denied();
      } else if (isTimeout(err)) {
        walletToast.timeout();
        setConnectError("timeout");
      } else {
        walletToast.connectError();
        setConnectError("error");
        Sentry.captureException(err);
      }
    } finally {
      setIsConnecting(false);
    }
  }

  function switchWallet(key: string) {
    setActiveWallet(key);
    window.dispatchEvent(
      new CustomEvent("wallet-connected", { detail: { publicKey: key } })
    );
  }

  function disconnectWallet() {
    disconnect();
    walletToast.disconnected();
    window.dispatchEvent(new CustomEvent("wallet-disconnected"));
  }

  function disconnectAllWallets() {
    disconnectAll();
    walletToast.disconnected();
    window.dispatchEvent(new CustomEvent("wallet-disconnected"));
  }

  return {
    publicKey,
    connected,
    wallets,
    activePublicKey,
    connect,
    connectAnother,
    switchWallet,
    setWalletNickname,
    disconnect: disconnectWallet,
    disconnectAll: disconnectAllWallets,
    sign,
    isConnecting,
    isSigning,
    connectError,
    clearConnectError,
  };
}
