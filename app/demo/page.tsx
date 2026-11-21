"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { StopLossSlider } from "@/components/ui/stop-loss-slider";
import { CopyField } from "@/components/ui/copy-field";
import { CopyButton } from "@/components/ui/copy-button";
import { useStopLoss } from "@/hooks/useStopLoss";

const MOCK_WALLET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const MOCK_TX_HASH =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const ENTRY_PRICE = 0.1234; // XLM price in USD

export default function DemoPage() {
  const { stopLossPercent, stopLossPrice, setStopLossPercent, reset } =
    useStopLoss({ initialValue: 5, entryPrice: ENTRY_PRICE });

  const [modalOpen, setModalOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:gap-10 sm:p-8">
      <motion.div
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -20 }}
        animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.4 }}
        className="w-full max-w-md space-y-6 sm:space-y-10"
      >
        <h1 className="text-2xl font-bold tracking-tight">Component Demo</h1>

        {/* ── Issue #22: Stop-Loss Slider ─────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 sm:p-6">
          <h2 className="text-base font-semibold">#22 — Stop-Loss Slider</h2>

          <StopLossSlider
            value={stopLossPercent}
            onChange={setStopLossPercent}
            entryPrice={ENTRY_PRICE}
            assetSymbol="XLM"
          />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Stop price:{" "}
              <strong className="text-foreground">
                {stopLossPrice?.toFixed(6) ?? "—"} XLM
              </strong>
            </span>
            <button
              onClick={reset}
              className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Simulate modal persistence */}
          <button
            onClick={() => setModalOpen((o) => !o)}
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            {modalOpen ? "Close modal (value persists)" : "Open modal"}
          </button>

          {modalOpen && (
            <motion.div
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={prefersReduced ? { duration: 0 } : undefined}
              className="rounded-lg border border-border bg-muted/40 p-4 space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Modal is open — slider value persists:
              </p>
              <StopLossSlider
                value={stopLossPercent}
                onChange={setStopLossPercent}
                entryPrice={ENTRY_PRICE}
                assetSymbol="XLM"
              />
            </motion.div>
          )}
        </section>

        {/* ── Issue #37: Copy-to-Clipboard ────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4 sm:p-6">
          <h2 className="text-base font-semibold">#37 — Copy-to-Clipboard</h2>

          <CopyField
            label="Wallet Address"
            value={MOCK_WALLET}
            truncateChars={8}
          />

          <CopyField
            label="Transaction Hash"
            value={MOCK_TX_HASH}
            truncateChars={10}
          />

          {/* Standalone CopyButton usage */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Inline copy button:
            </span>
            <CopyButton value={MOCK_WALLET} label="Copy address" />
          </div>
        </section>
      </motion.div>
    </main>
  );
}
