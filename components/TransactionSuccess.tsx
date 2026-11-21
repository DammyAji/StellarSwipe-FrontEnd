"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ArrowRight, Eye, X, Bell, BellOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useTransactionStore } from "@/store/useTransactionStore";
import { useToastStore } from "@/store/useToastStore";
import { getExplorerTxUrl, normalizeNetwork } from "@/lib/stellar/explorer";
import { showNotification } from "@/lib/notifications";
import { useNotificationPreference } from "@/hooks/useNotificationPreference";
import { JournalFromTransactionButton } from "@/components/JournalFromTransactionButton";
import analyticsService from "@/services/analytics";
import { toast } from "@/lib/toast";
import { downloadTradeReceipt, getTransactionExplorerUrl } from "@/lib/tradeReceipt";

const AUTO_DISMISS_MS = 8000;

export function TransactionSuccess() {
  const { success, showSuccess, clearSuccess } = useTransactionStore();
  const enqueueToast = useToastStore((state) => state.enqueue);
  const { alertsEnabled, toggleAlerts, categoryPreferences } =
    useNotificationPreference();

  const handleViewPortfolio = useCallback(() => {
    clearSuccess();
  }, [clearSuccess]);

  const handleDownloadReceipt = useCallback(() => {
    if (!success) return;
    try {
      downloadTradeReceipt(success);
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Couldn't generate receipt", { description: "Please try again." });
    }
  }, [success]);

  const handleContinueSwiping = useCallback(
    () => clearSuccess(),
    [clearSuccess]
  );

  useEffect(() => {
    if (!showSuccess || !success) return;
    if (alertsEnabled && categoryPreferences.systemUpdates) {
      showNotification("Trade Executed", {
        body: `Your swap for ${success.token} at ${success.price} completed successfully`,
        icon: "✓",
        category: "systemUpdates",
        critical: true,
      });
    }
    analyticsService.track("trade_confirmation_success", {
      asset_pair: success.token,
      amount: success.amount,
      price: success.price,
    });
    enqueueToast({
      tone: "success",
      title: "Trade executed",
      description: `${success.amount} ${success.token} confirmed on-chain.`,
    });
  }, [
    showSuccess,
    success,
    alertsEnabled,
    categoryPreferences.systemUpdates,
    enqueueToast,
  ]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(clearSuccess, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [showSuccess, clearSuccess]);

  if (!success) return null;

  const hash = success.hash?.trim() || null;
  const truncatedHash = hash ? `${hash.slice(0, 8)}...${hash.slice(-6)}` : null;
  const network = success.network ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  const explorerUrl = getExplorerTxUrl(hash, network);
  const networkLabel = normalizeNetwork(network) === "testnet" ? "Testnet" : "Mainnet";
  const time = formatTime(success.timestamp);

  return (
    <AnimatePresence>
      {showSuccess && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="absolute inset-0 bg-overlay/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearSuccess}
          />

          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-2xl shadow-emerald-500/10 sm:p-6"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="absolute right-4 top-4 flex gap-2">
              <button
                onClick={() => toggleAlerts(!alertsEnabled)}
                aria-label={
                  alertsEnabled
                    ? "Disable outcome alerts"
                    : "Enable outcome alerts"
                }
                className="rounded-full p-1 text-foreground-subtle transition-colors hover:bg-surface-high hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={alertsEnabled ? "Alerts enabled" : "Alerts disabled"}
              >
                {alertsEnabled ? (
                  <Bell className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <BellOff className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <button
                onClick={clearSuccess}
                aria-label="Close"
                className="rounded-full p-1 text-foreground-subtle transition-colors hover:bg-surface-high hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4 flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
              >
                <div className="relative">
                  <motion.div
                    className="absolute -inset-2 rounded-full bg-accent-success/20 blur-xl"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <CheckCircle className="relative h-14 w-14 text-accent-success" />
                </div>
              </motion.div>
            </div>

            <motion.h2
              id="tx-success-title"
              className="mb-1 text-center text-xl font-semibold text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Trade Executed
            </motion.h2>
            <motion.p
              className="mb-6 text-center text-sm text-foreground-muted"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              Your swap completed successfully
            </motion.p>

            <motion.div
              className="mb-6 space-y-3 rounded-xl bg-surface-high p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <DetailRow label="Token" value={success.token} />
              <DetailRow label="Amount" value={success.amount} />
              <DetailRow label="Price" value={success.price} />
              <DetailRow label="Fee" value={success.fee} />
              <DetailRow label="Network" value={networkLabel} />
              <DetailRow label="Time" value={time} />
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-foreground-subtle">
                  Transaction
                </span>
                {hash && explorerUrl ? (
                  <div className="flex items-center gap-2">
                    <CopyButton value={hash} label="Copy hash" />
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-mono text-accent-success transition-colors hover:opacity-80"
                    >
                      {truncatedHash}
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-sm text-foreground-subtle">Unavailable</span>
                )}
              </div>
            </motion.div>

            <Button
              onClick={handleDownloadReceipt}
              variant="outline"
              className="mb-2 w-full gap-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download receipt
            </Button>

            <motion.div
              className="flex flex-col gap-2 sm:flex-row"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Button
                onClick={handleViewPortfolio}
                className="flex-1 gap-2 bg-accent-success text-foreground hover:opacity-90"
              >
                <Eye className="h-4 w-4" />
                View Portfolio
              </Button>
              <Button
                onClick={handleContinueSwiping}
                variant="outline"
                className="flex-1 gap-2"
              >
                Continue Swiping
                <ArrowRight className="h-4 w-4" />
              </Button>
              <JournalFromTransactionButton
                transaction={success}
                onStarted={clearSuccess}
                className="flex-1 gap-2"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatTime(timestamp?: number): string | null {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
