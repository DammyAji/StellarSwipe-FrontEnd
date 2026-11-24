"use client";

import { useEffect, useRef } from "react";

interface TradeExecutionStatusProps {
  isExecuting: boolean;
  executionTimeMs: number | null;
  estimatedTimeMs: number | null;
  liveSlippage: number;
  error: string | null;
  onRetry?: () => void;
  /** Confirmed actual amount received from the trade result; null when unavailable. */
  actualAmount?: number | null;
  /** Confirmed actual fee charged by the trade result; null when unavailable. */
  actualFee?: number | null;
  /** Symbol/unit for the actual amount (e.g. token ticker). */
  actualAmountSymbol?: string | null;
  /** Symbol/unit for the actual fee. */
  actualFeeSymbol?: string | null;
}

/**
 * Displays real-time trade execution status (#165)
 * - Estimated execution time
 * - Live slippage changes
 * - Execution time after completion
 * - Timeout error with retry
 */
export function TradeExecutionStatus({
  isExecuting,
  executionTimeMs,
  estimatedTimeMs,
  liveSlippage,
  error,
  onRetry,
  actualAmount = null,
  actualFee = null,
  actualAmountSymbol = null,
  actualFeeSymbol = null,
}: TradeExecutionStatusProps) {
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isExecuting) {
      startTimeRef.current = performance.now();
      const tick = () => {
        if (elapsedRef.current && startTimeRef.current !== null) {
          const elapsed = Math.round(performance.now() - startTimeRef.current);
          elapsedRef.current.textContent = `${elapsed}ms`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isExecuting]);

  if (!isExecuting && !executionTimeMs && !error) return null;

  return (
    <div
      className="rounded-lg border bg-card p-3 text-sm space-y-1"
      role="status"
      aria-live="polite"
    >
      {isExecuting && (
        <>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Executing trade…</span>
            <span ref={elapsedRef} className="font-mono text-xs">
              0ms
            </span>
          </div>
          {estimatedTimeMs && (
            <div className="text-xs text-muted-foreground">
              Est. completion: ~{estimatedTimeMs}ms
            </div>
          )}
          {liveSlippage > 0 && (
            <div
              className={`text-xs font-medium ${
                liveSlippage > 1 ? "text-yellow-500" : "text-green-500"
              }`}
            >
              Live slippage: {liveSlippage}%
            </div>
          )}
        </>
      )}

      {!isExecuting && executionTimeMs !== null && !error && (
        <>
          <div className="flex items-center justify-between text-green-500">
            <span>Trade confirmed</span>
            <span className="font-mono text-xs">{executionTimeMs}ms</span>
          </div>
          <dl className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex items-center justify-between">
              <dt>Actual amount received</dt>
              <dd className="font-mono">
                {actualAmount !== null
                  ? `${actualAmount}${
                      actualAmountSymbol ? ` ${actualAmountSymbol}` : ""
                    }`
                  : "Unavailable"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Actual fee</dt>
              <dd className="font-mono">
                {actualFee !== null
                  ? `${actualFee}${actualFeeSymbol ? ` ${actualFeeSymbol}` : ""}`
                  : "Unavailable"}
              </dd>
            </div>
          </dl>
        </>
      )}

      {error && (
        <div className="flex items-center justify-between text-red-500">
          <span className="text-xs">{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs underline hover:no-underline ml-2"
              aria-label="Retry trade"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
