"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowDown, ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Token {
  symbol: string;
  name: string;
  balance: string;
  initials: string;
}

const TOKENS: Token[] = [
  { symbol: "XLM", name: "Stellar Lumens", balance: "1,234.56", initials: "XL" },
  { symbol: "USDC", name: "USD Coin",       balance: "500.00",   initials: "US" },
];

const EXCHANGE_RATE = 0.094; // 1 XLM = 0.094 USDC (mock)

interface TokenSwapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenSwapModal({ open, onOpenChange }: TokenSwapModalProps) {
  const [fromToken, setFromToken] = React.useState<Token>(TOKENS[0]);
  const [toToken, setToToken]     = React.useState<Token>(TOKENS[1]);
  const [fromAmount, setFromAmount] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const toAmount    = fromAmount ? (parseFloat(fromAmount) * EXCHANGE_RATE).toFixed(6) : "";
  const minReceived = toAmount   ? (parseFloat(toAmount)   * 0.995).toFixed(6)         : "—";
  const canConfirm  = !!fromAmount && parseFloat(fromAmount) > 0;

  function handleSwapDirection() {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsSubmitting(false);
    onOpenChange(false);
  }

  // Reset state when modal closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setFromAmount("");
      setIsSubmitting(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

        {/* Content — bottom sheet on mobile, centred dialog on ≥sm */}
        <Dialog.Content
          aria-describedby="trade-modal-desc"
          className={cn(
            "dialog-content",
            /* mobile: full-width bottom sheet */
            "fixed bottom-0 left-0 right-0 z-50",
            "flex max-h-[90dvh] flex-col",
            "rounded-t-2xl bg-background shadow-2xl outline-none",
            /* desktop: centred dialog */
            "sm:bottom-auto sm:left-1/2 sm:top-1/2",
            "sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:w-full sm:max-w-md",
            "sm:max-h-[85vh] sm:rounded-2xl",
          )}
        >
          {/* Hidden description for screen readers */}
          <p id="trade-modal-desc" className="sr-only">
            Swap tokens on the Stellar network
          </p>

          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Dialog.Title className="text-lg font-semibold">Swap</Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Close swap modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6">

            {/* From */}
            <section aria-labelledby="from-label">
              <p
                id="from-label"
                className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                You pay
              </p>
              <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <TokenChip token={fromToken} />
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold outline-none placeholder:text-muted-foreground/40"
                    aria-label={`Amount of ${fromToken.symbol} to swap`}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{fromToken.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span>Balance: {fromToken.balance}</span>
                    <button
                      type="button"
                      onClick={() => setFromAmount(fromToken.balance.replace(",", ""))}
                      className="rounded px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Direction toggle */}
            <div className="my-2 flex justify-center">
              <button
                type="button"
                onClick={handleSwapDirection}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm transition-all hover:bg-accent active:scale-90"
                aria-label="Flip swap direction"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* To */}
            <section aria-labelledby="to-label">
              <p
                id="to-label"
                className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                You receive
              </p>
              <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <TokenChip token={toToken} />
                  <span
                    className="min-w-0 flex-1 text-right text-2xl font-semibold text-muted-foreground"
                    aria-label={`Estimated amount of ${toToken.symbol} to receive`}
                    aria-live="polite"
                  >
                    {toAmount || "0.00"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">{toToken.name}</span>
                  <span>Balance: {toToken.balance}</span>
                </div>
              </div>
            </section>

            {/* Trade details — shown once amount is entered */}
            {canConfirm && (
              <section
                aria-labelledby="details-heading"
                className="mt-4 rounded-xl border p-3 sm:p-4"
              >
                <h2
                  id="details-heading"
                  className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Trade details
                </h2>
                <dl className="space-y-2.5 text-sm">
                  <TradeRow
                    label="Exchange rate"
                    value={`1 ${fromToken.symbol} = ${EXCHANGE_RATE} ${toToken.symbol}`}
                  />
                  <TradeRow
                    label="Min. received"
                    hint="Minimum amount after 0.5% slippage tolerance"
                    value={`${minReceived} ${toToken.symbol}`}
                  />
                  <TradeRow
                    label="Price impact"
                    value="< 0.01%"
                    valueClassName="text-green-600 dark:text-green-400"
                  />
                  <TradeRow label="Network fee" value="~0.00001 XLM" />
                </dl>
              </section>
            )}

            {/* Scroll breathing room */}
            <div className="h-4" aria-hidden="true" />
          </div>

          {/* ── Sticky footer / confirm ──────────────────────────────────── */}
          <div className="border-t bg-background px-4 pb-safe pt-3 sm:px-6">
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || isSubmitting}
              className="h-12 w-full text-base font-semibold sm:h-11"
            >
              {isSubmitting
                ? "Confirming…"
                : canConfirm
                  ? `Swap ${fromToken.symbol} → ${toToken.symbol}`
                  : "Enter an amount"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── Internal sub-components ───────────────────────────────────────────── */

function TokenChip({ token }: { token: Token }) {
  return (
    <button
      type="button"
      className="flex shrink-0 items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-accent active:scale-95"
      aria-label={`Select token: ${token.symbol}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
        {token.initials}
      </span>
      {token.symbol}
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function TradeRow({
  label,
  hint,
  value,
  valueClassName,
}: {
  label: string;
  hint?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-1 text-muted-foreground">
        {label}
        {hint && (
          <span title={hint} aria-label={hint}>
            <Info className="h-3 w-3" />
          </span>
        )}
      </dt>
      <dd className={cn("truncate text-right font-medium tabular-nums", valueClassName)}>
        {value}
      </dd>
    </div>
  );
}
