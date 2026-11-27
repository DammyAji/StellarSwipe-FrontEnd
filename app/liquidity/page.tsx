"use client";

import { useMemo, useState } from "react";

interface PoolReserves {
  tokenA: number;
  tokenB: number;
  symbolA: string;
  symbolB: string;
  totalLpSupply: number;
}

interface UserPosition {
  lpBalance: number;
}

const POOL: PoolReserves = {
  tokenA: 125000,
  tokenB: 62500,
  symbolA: "USDC",
  symbolB: "ETH",
  totalLpSupply: 88000,
};

const USER: UserPosition = {
  lpBalance: 4400,
};

type Toast = { id: number; kind: "success" | "error"; message: string };

type PendingTx =
  | { type: "deposit"; amountA: number; amountB: number; lpMinted: number }
  | { type: "withdraw"; lpBurned: number; amountA: number; amountB: number };

function format(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export default function LiquidityPage() {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [pending, setPending] = useState<PendingTx | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const ratio = POOL.tokenB / POOL.tokenA;
  const sharePercent = POOL.totalLpSupply > 0 ? (USER.lpBalance / POOL.totalLpSupply) * 100 : 0;

  const parsedA = Number(amountA) || 0;
  const parsedB = Number(amountB) || 0;
  const parsedLp = Number(lpAmount) || 0;

  const lpMinted = useMemo(() => {
    if (POOL.totalLpSupply === 0) return 0;
    const shareA = parsedA / POOL.tokenA;
    const shareB = parsedB / POOL.tokenB;
    return Math.min(shareA, shareB) * POOL.totalLpSupply;
  }, [parsedA, parsedB]);

  const withdrawA = POOL.totalLpSupply > 0 ? (parsedLp / POOL.totalLpSupply) * POOL.tokenA : 0;
  const withdrawB = POOL.totalLpSupply > 0 ? (parsedLp / POOL.totalLpSupply) * POOL.tokenB : 0;

  function pushToast(kind: Toast["kind"], message: string) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function handleAmountAChange(value: string) {
    setAmountA(value);
    const a = Number(value) || 0;
    setAmountB(a > 0 ? String(Number((a * ratio).toFixed(6))) : "");
  }

  function handleAmountBChange(value: string) {
    setAmountB(value);
    const b = Number(value) || 0;
    setAmountA(b > 0 ? String(Number((b / ratio).toFixed(6))) : "");
  }

  function requestDeposit() {
    if (parsedA <= 0 || parsedB <= 0) {
      pushToast("error", "Enter both token amounts to deposit");
      return;
    }
    setPending({ type: "deposit", amountA: parsedA, amountB: parsedB, lpMinted });
  }

  function requestWithdraw() {
    if (parsedLp <= 0) {
      pushToast("error", "Enter an LP token amount to withdraw");
      return;
    }
    if (parsedLp > USER.lpBalance) {
      pushToast("error", "Amount exceeds your LP balance");
      return;
    }
    setPending({ type: "withdraw", lpBurned: parsedLp, amountA: withdrawA, amountB: withdrawB });
  }

  function confirmTransaction() {
    if (!pending) return;
    try {
      if (pending.type === "deposit") {
        pushToast(
          "success",
          `Deposited ${format(pending.amountA)} ${POOL.symbolA} and ${format(pending.amountB)} ${POOL.symbolB}`
        );
        setAmountA("");
        setAmountB("");
      } else {
        pushToast(
          "success",
          `Withdrew ${format(pending.amountA)} ${POOL.symbolA} and ${format(pending.amountB)} ${POOL.symbolB}`
        );
        setLpAmount("");
      }
    } catch {
      pushToast("error", "Transaction failed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Liquidity</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <div>
          <div className="text-gray-500">Pool Reserves</div>
          <div className="font-medium">
            {format(POOL.tokenA, 2)} {POOL.symbolA} / {format(POOL.tokenB, 2)} {POOL.symbolB}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Your Position</div>
          <div className="font-medium">
            {format(USER.lpBalance, 2)} LP ({format(sharePercent, 2)}%)
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("deposit")}
          className={`flex-1 rounded-md px-4 py-2 ${tab === "deposit" ? "bg-blue-600 text-white" : "border"}`}
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setTab("withdraw")}
          className={`flex-1 rounded-md px-4 py-2 ${tab === "withdraw" ? "bg-blue-600 text-white" : "border"}`}
        >
          Withdraw
        </button>
      </div>

      {tab === "deposit" ? (
        <div className="space-y-4 rounded-lg border p-4">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-500">{POOL.symbolA} amount</span>
            <input
              type="number"
              min="0"
              value={amountA}
              onChange={(e) => handleAmountAChange(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="0.0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-500">{POOL.symbolB} amount</span>
            <input
              type="number"
              min="0"
              value={amountB}
              onChange={(e) => handleAmountBChange(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="0.0"
            />
          </label>
          <div className="text-sm text-gray-500">
            Expected LP tokens minted: <span className="font-medium">{format(lpMinted)}</span>
          </div>
          <button
            type="button"
            onClick={requestDeposit}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white"
          >
            Deposit
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-500">LP token amount</span>
            <input
              type="number"
              min="0"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
              placeholder="0.0"
            />
          </label>
          <div className="text-sm text-gray-500">
            You will receive: <span className="font-medium">{format(withdrawA)} {POOL.symbolA}</span> and{" "}
            <span className="font-medium">{format(withdrawB)} {POOL.symbolB}</span>
          </div>
          <button
            type="button"
            onClick={requestWithdraw}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white"
          >
            Withdraw
          </button>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Confirm Transaction</h2>
            <div className="space-y-2 text-sm">
              {pending.type === "deposit" ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{POOL.symbolA} deposit</span>
                    <span>{format(pending.amountA)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{POOL.symbolB} deposit</span>
                    <span>{format(pending.amountB)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">LP tokens minted</span>
                    <span>{format(pending.lpMinted)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">LP tokens burned</span>
                    <span>{format(pending.lpBurned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{POOL.symbolA} received</span>
                    <span>{format(pending.amountA)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{POOL.symbolB} received</span>
                    <span>{format(pending.amountB)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 rounded-md border px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTransaction}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md px-4 py-2 text-sm text-white shadow ${
              toast.kind === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
