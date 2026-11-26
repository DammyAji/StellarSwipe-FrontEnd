"use client";

import { Suspense, useMemo, useState } from "react";
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

const POOL = {
  tokenA: "ETH",
  tokenB: "USDC",
  reserveA: 1200,
  reserveB: 2_400_000,
  totalLp: 1_000_000,
};

const USER_LP = 42_500;

function formatAmount(value: number, decimals = 4): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function LiquidityManager() {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const ratio = POOL.reserveB / POOL.reserveA;
  const sharePct = (USER_LP / POOL.totalLp) * 100;

  const depositA = Number(amountA) || 0;
  const depositB = Number(amountB) || 0;
  const lpMinted = depositA > 0 ? (depositA / POOL.reserveA) * POOL.totalLp : 0;

  const burnLp = Number(lpAmount) || 0;
  const receiveA = (burnLp / POOL.totalLp) * POOL.reserveA;
  const receiveB = (burnLp / POOL.totalLp) * POOL.reserveB;

  const depositValid = depositA > 0 && depositB > 0;
  const withdrawValid = burnLp > 0 && burnLp <= USER_LP;

  const breakdown = useMemo(() => {
    if (mode === "deposit") {
      return [
        { label: `Deposit ${POOL.tokenA}`, value: formatAmount(depositA) },
        { label: `Deposit ${POOL.tokenB}`, value: formatAmount(depositB) },
        { label: "LP tokens minted", value: formatAmount(lpMinted) },
      ];
    }
    return [
      { label: "LP tokens burned", value: formatAmount(burnLp) },
      { label: `Receive ${POOL.tokenA}`, value: formatAmount(receiveA) },
      { label: `Receive ${POOL.tokenB}`, value: formatAmount(receiveB) },
    ];
  }, [mode, depositA, depositB, lpMinted, burnLp, receiveA, receiveB]);

  function handleAmountAChange(value: string) {
    setAmountA(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmountB(formatAmount(parsed * ratio));
    } else {
      setAmountB("");
    }
  }

  function handleAmountBChange(value: string) {
    setAmountB(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      setAmountA(formatAmount(parsed / ratio));
    } else {
      setAmountA("");
    }
  }

  function handleConfirm() {
    const valid = mode === "deposit" ? depositValid : withdrawValid;
    if (!valid) {
      setToast({ type: "error", message: "Enter valid amounts before confirming." });
      setConfirming(false);
      return;
    }
    setToast({
      type: "success",
      message:
        mode === "deposit"
          ? `Deposited ${formatAmount(depositA)} ${POOL.tokenA} and ${formatAmount(depositB)} ${POOL.tokenB}.`
          : `Withdrew ${formatAmount(receiveA)} ${POOL.tokenA} and ${formatAmount(receiveB)} ${POOL.tokenB}.`,
    });
    setConfirming(false);
    setAmountA("");
    setAmountB("");
    setLpAmount("");
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-white">Liquidity Pool</h2>
        <p className="text-sm text-slate-400">
          {POOL.tokenA}/{POOL.tokenB} pool · reserves {formatAmount(POOL.reserveA)} {POOL.tokenA} /{" "}
          {formatAmount(POOL.reserveB)} {POOL.tokenB}
        </p>
        <p className="text-sm text-slate-400">
          Your LP balance: {formatAmount(USER_LP)} LP · Pool share: {sharePct.toFixed(2)}%
        </p>
      </header>

      <div className="flex gap-2" role="tablist" aria-label="Liquidity action">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "deposit"}
          onClick={() => setMode("deposit")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === "deposit" ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300"}`}
        >
          Deposit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "withdraw"}
          onClick={() => setMode("withdraw")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === "withdraw" ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300"}`}
        >
          Withdraw
        </button>
      </div>

      {mode === "deposit" ? (
        <div className="space-y-3">
          <label className="block text-sm text-slate-300">
            {POOL.tokenA} amount
            <input
              type="number"
              min="0"
              value={amountA}
              onChange={(e) => handleAmountAChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
              placeholder="0.0"
            />
          </label>
          <label className="block text-sm text-slate-300">
            {POOL.tokenB} amount
            <input
              type="number"
              min="0"
              value={amountB}
              onChange={(e) => handleAmountBChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
              placeholder="0.0"
            />
          </label>
          <p className="text-sm text-slate-400">Expected LP tokens minted: {formatAmount(lpMinted)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-slate-300">
            LP token amount
            <input
              type="number"
              min="0"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
              placeholder="0.0"
            />
          </label>
          <p className="text-sm text-slate-400">
            You will receive {formatAmount(receiveA)} {POOL.tokenA} and {formatAmount(receiveB)} {POOL.tokenB}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950"
      >
        {mode === "deposit" ? "Deposit" : "Withdraw"}
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h3 className="text-base font-semibold text-white">Confirm {mode}</h3>
            <dl className="space-y-2 text-sm">
              {breakdown.map((row) => (
                <div key={row.label} className="flex justify-between text-slate-300">
                  <dt>{row.label}</dt>
                  <dd className="text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl bg-white/5 px-4 py-2 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`rounded-xl px-4 py-2 text-sm ${toast.type === "success" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}

export default function AppPage() {
  return (
    <AppShell>
      <LiquidityManager />
      <Suspense fallback={<SignalFeedSkeleton />}>
        <SignalFeedServer />
      </Suspense>
    </AppShell>
  );
}
