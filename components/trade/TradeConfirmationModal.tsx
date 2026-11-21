"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssetIssuerDetails } from "@/components/trade/AssetIssuerDetails";
import { useWalletStore } from "@/store/useWalletStore";
import { useRegisterActiveFlow } from "@/hooks/useActiveFlow";
import type { TradeAssetInfo } from "@/lib/assetIssuer";

// ── Types ────────────────────────────────────────────────────────────────────

export type OrderType = "market" | "limit";

export interface TradeConfirmationDetails {
  orderType: OrderType;
  fromSymbol: string;
  fromAmount: string;
  toSymbol: string;
  toAmount: string;
  /** Market: shown as exchange rate. Limit: the user-specified trigger price. */
  price: string;
  minReceived: string;
  priceImpact?: string;
  networkFee?: string;
  platformFee?: string;
  /** Limit only: expiry label e.g. "24h", "7 days" */
  expiry?: string;
  /** Issuer metadata for the asset being sold. Omit for native XLM or when unknown. */
  fromAsset?: Omit<TradeAssetInfo, "code">;
  /** Issuer metadata for the asset being bought. Omit for native XLM or when unknown. */
  toAsset?: Omit<TradeAssetInfo, "code">;
  /** Network the order will be submitted to. Defaults to the wallet store's network. */
  network?: string;
  /** Used to simulate a deliberate visual regression for testing */
  _visualRegressionTest?: boolean;
}

export interface TradeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: TradeConfirmationDetails;
  isSubmitting?: boolean;
  onConfirm?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TradeConfirmationModal({
  open,
  onOpenChange,
  details,
  isSubmitting = false,
  onConfirm,
}: TradeConfirmationModalProps) {
  const {
    orderType,
    fromSymbol,
    fromAmount,
    toSymbol,
    toAmount,
    price,
    minReceived,
    priceImpact = "< 0.01%",
    networkFee = "~0.00001 XLM",
    platformFee = "0.1%",
    expiry,
    fromAsset,
    toAsset,
    network,
    _visualRegressionTest = false,
  } = details;
  const walletNetwork = useWalletStore((s) => s.network);

  // An open review is bound to the current network; let a network switch
  // identify it and close it first (#800). Once submitting, it can't be
  // safely abandoned from here, so it's listed without a cancel action.
  useRegisterActiveFlow(open, {
    kind: isSubmitting ? "signing" : "trade",
    label: `${fromSymbol} → ${toSymbol} ${orderType} order${
      isSubmitting ? " (submitting)" : ""
    }`,
    cancel: isSubmitting ? undefined : () => onOpenChange(false),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="trade-confirm-desc"
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "flex max-h-[90dvh] flex-col",
            "rounded-t-2xl bg-background shadow-2xl outline-none",
            // Short landscape viewports (phones rotated): keep the sheet
            // inside the viewport so the footer action never overlaps the
            // fee/risk rows, which stay reachable via the scrollable body.
            "max-[900px]:landscape:max-h-[100dvh]",
            "max-[900px]:landscape:rounded-none",
            "sm:bottom-auto sm:left-1/2 sm:top-1/2",
            "sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:w-full sm:max-w-md sm:max-h-[85vh] sm:rounded-2xl",
            "sm:landscape:max-h-[calc(100dvh-1rem)]"
          )}
        >
          <p id="trade-confirm-desc" className="sr-only">
            Confirm your {orderType} order before submitting to the network
          </p>

          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden max-[900px]:landscape:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 max-[900px]:landscape:py-2">
            <Dialog.Title className="text-lg font-semibold">
              Confirm {orderType === "limit" ? "Limit" : "Market"} Order
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Close confirmation modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6 space-y-4 max-[900px]:landscape:space-y-3 max-[900px]:landscape:pb-3">
            {/* Trade summary */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">You pay</span>
                <span className="font-semibold text-lg">
                  {fromAmount} {fromSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  You receive
                </span>
                <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                  {toAmount} {toSymbol}
                </span>
              </div>
            </div>

            {/* Asset identity — code, issuer and network for both sides (#806) */}
            <AssetIssuerDetails
              network={network ?? walletNetwork}
              sides={[
                { label: "You pay", asset: { ...fromAsset, code: fromSymbol } },
                { label: "You receive", asset: { ...toAsset, code: toSymbol } },
              ]}
            />

            {/* Order details */}
            <section aria-labelledby="order-details-heading">
              <h2
                id="order-details-heading"
                className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                Order Details
              </h2>
              <dl className="rounded-xl border p-3 sm:p-4 space-y-2.5 text-sm">
                <Row
                  label={
                    orderType === "limit" ? "Limit price" : "Exchange rate"
                  }
                  value={price}
                />
                <Row
                  label="Min. received"
                  hint="Minimum amount after 0.5% slippage tolerance"
                  value={`${minReceived} ${toSymbol}`}
                />
                <Row
                  label="Price impact"
                  value={priceImpact}
                  valueClassName="text-green-600 dark:text-green-400"
                />
                {orderType === "limit" && expiry && (
                  <Row label="Order expiry" value={expiry} />
                )}
                <Row label="Network fee" value={networkFee} />
                {/* Fee display — intentionally misaligned in regression test story */}
                <div
                  className={cn(
                    "flex items-center justify-between",
                    _visualRegressionTest && "flex-col items-start gap-1"
                  )}
                >
                  <span className="text-muted-foreground">Platform fee</span>
                  <span
                    className={cn(
                      "font-mono font-medium",
                      _visualRegressionTest && "ml-4 text-destructive"
                    )}
                  >
                    {platformFee}
                  </span>
                </div>
              </dl>
            </section>

            {/* Fee disclosure */}
            <div
              className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm"
              aria-label="Fee disclosure"
            >
              <div className="flex items-center gap-1.5 mb-2 text-muted-foreground font-medium text-xs">
                <Info size={13} aria-hidden="true" />
                <span>
                  0.1% platform fee — 50% to signal provider, 50% to platform
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Network fees are charged separately by the Stellar network.
              </p>
            </div>

            <div className="h-4 max-[900px]:landscape:hidden" aria-hidden="true" />
          </div>

          {/* Footer */}
          <div className="border-t bg-background px-4 pb-6 pt-3 sm:px-6 sm:pb-4 max-[900px]:landscape:pb-3 max-[900px]:landscape:pt-2">
            <Button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="h-12 w-full text-base font-semibold sm:h-11 max-[900px]:landscape:h-10"
            >
              {isSubmitting
                ? "Submitting…"
                : `Confirm ${orderType === "limit" ? "Limit" : ""} Order`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function Row({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <span title={hint} aria-label={hint}>
            <Info className="h-3 w-3 opacity-60" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className={cn("font-mono font-medium", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
