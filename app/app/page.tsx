"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SignalFeedServer } from "@/components/signal/SignalFeedServer";
import { SignalCardSkeleton } from "@/components/SignalCardSkeleton";

function SignalFeedSkeleton() {
  return (
    <div
      className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4"
      role="status"
      aria-label="Loading signal feed"
    >
      <span className="sr-only">Loading signal feed…</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <SignalCardSkeleton key={i} />
      ))}
    </div>
  );
}

interface Token {
  symbol: string;
  name: string;
  reserve: number;
}

const SUPPORTED_TOKENS: Token[] = [
  { symbol: "XLM", name: "Stellar Lumens", reserve: 1_000_000 },
  { symbol: "USDC", name: "USD Coin", reserve: 500_000 },
  { symbol: "AQUA", name: "Aqua Token", reserve: 250_000 },
  { symbol: "yXLM", name: "Yield XLM", reserve: 120_000 },
];

const DEFAULT_SLIPPAGE = 0.5;

function estimateOutput(
  amountIn: number,
  from: Token,
  to: Token,
): { output: number; priceImpact: number } {
  if (!amountIn || amountIn <= 0) return { output: 0, priceImpact: 0 };
  const reserveIn = from.reserve;
  const reserveOut = to.reserve;
  const amountInWithFee = amountIn * 0.997;
  const output =
    (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
  const spotPrice = reserveOut / reserveIn;
  const executionPrice = output / amountIn;
  const priceImpact = Math.max(0, (1 - executionPrice / spotPrice) * 100);
  return { output, priceImpact };
}

function SwapInterface() {
  const [fromSymbol, setFromSymbol] = useState(SUPPORTED_TOKENS[0].symbol);
  const [toSymbol, setToSymbol] = useState(SUPPORTED_TOKENS[1].symbol);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<{ output: number; priceImpact: number }>({
    output: 0,
    priceImpact: 0,
  });
  const walletConnected = false;

  const fromToken = useMemo(
    () => SUPPORTED_TOKENS.find((t) => t.symbol === fromSymbol)!,
    [fromSymbol],
  );
  const toToken = useMemo(
    () => SUPPORTED_TOKENS.find((t) => t.symbol === toSymbol)!,
    [toSymbol],
  );

  const parsedAmount = Number.parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const fetchQuote = useCallback(() => {
    if (!amountValid) {
      setQuote({ output: 0, priceImpact: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      setQuote(estimateOutput(parsedAmount, fromToken, toToken));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [amountValid, parsedAmount, fromToken, toToken]);

  useEffect(() => {
    const cleanup = fetchQuote();
    return cleanup;
  }, [fetchQuote]);

  const handleSwapTokens = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
  };

  const canSwap = walletConnected && amountValid && !loading;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Swap</h2>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label="Swap settings"
          aria-expanded={showSettings}
          className="rounded-full border border-white/10 p-2 text-slate-300 hover:text-white"
        >
          ⚙
        </button>
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 space-y-2">
          <label
            htmlFor="slippage"
            className="block text-sm text-slate-300"
          >
            Slippage tolerance (%)
          </label>
          <input
            id="slippage"
            type="number"
            min={0}
            step={0.1}
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
          />
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="from-amount" className="block text-sm text-slate-300">
          From
        </label>
        <div className="flex gap-2">
          <input
            id="from-amount"
            type="number"
            min={0}
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
          />
          <select
            aria-label="Input token"
            value={fromSymbol}
            onChange={(e) => setFromSymbol(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
          >
            {SUPPORTED_TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleSwapTokens}
          aria-label="Swap token direction"
          className="rounded-full border border-white/10 p-2 text-slate-300 hover:text-white"
        >
          ⇅
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="to-amount" className="block text-sm text-slate-300">
          To (estimated)
        </label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
            {loading ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                role="status"
                aria-label="Fetching quote"
              />
            ) : (
              <span>{quote.output ? quote.output.toFixed(6) : "0.0"}</span>
            )}
          </div>
          <select
            aria-label="Output token"
            value={toSymbol}
            onChange={(e) => setToSymbol(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
          >
            {SUPPORTED_TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-slate-400">
        Price impact:{" "}
        <span className="text-slate-200">{quote.priceImpact.toFixed(2)}%</span>
      </p>

      <button
        type="button"
        disabled={!canSwap}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!walletConnected ? "Connect wallet" : "Swap"}
      </button>
    </div>
  );
}

export default function AppPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <SwapInterface />
        <Suspense fallback={<SignalFeedSkeleton />}>
          <SignalFeedServer />
        </Suspense>
      </div>
    </AppShell>
  );
}
