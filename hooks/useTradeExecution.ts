"use client";

import { useState, useCallback, useRef } from "react";
import {
  tradeExecutionService,
  type TradeRequest,
  type TradeResult,
  type ExecutionEstimate,
} from "@/services/tradeExecutionService";
import { roundToAssetPrecision } from "@/utils/assetPrecision";

/** Exact amount submitted to execution after asset precision rounding. */
export interface SubmittedAmount {
  /** Amount the user entered, before rounding. */
  requested: number;
  /** Amount actually submitted to execution (rounded to asset precision). */
  submitted: number;
  /** submitted - requested; non-zero when precision rules adjusted the input. */
  difference: number;
  /** Whether precision rounding changed the submitted amount. */
  wasRounded: boolean;
}

/** Confirmed actual amounts and fees from the executed trade. */
export interface ActualTradeAmounts {
  /** Actual amount received/sent as confirmed by the network, or null if unavailable. */
  actualAmount: number | null;
  /** Actual fee charged as confirmed, or null if unavailable. */
  actualFee: number | null;
  /** Actual fee asset, or null if unavailable. */
  feeAsset: string | null;
}

interface TradeExecutionState {
  isExecuting: boolean;
  result: TradeResult | null;
  error: string | null;
  executionTimeMs: number | null;
  estimate: ExecutionEstimate | null;
  liveSlippage: number;
  submittedAmount: SubmittedAmount | null;
  actualAmounts: ActualTradeAmounts | null;
}

function buildSubmittedAmount(
  requested: number,
  asset: string
): SubmittedAmount {
  const submitted = roundToAssetPrecision(requested, asset);
  const difference = parseFloat((submitted - requested).toFixed(7));
  return {
    requested,
    submitted,
    difference,
    wasRounded: difference !== 0,
  };
}

function extractActualAmounts(result: TradeResult): ActualTradeAmounts {
  const raw = result as unknown as Record<string, unknown>;
  const actualAmount =
    typeof raw.actualAmount === "number" && Number.isFinite(raw.actualAmount)
      ? raw.actualAmount
      : null;
  const actualFee =
    typeof raw.actualFee === "number" && Number.isFinite(raw.actualFee)
      ? raw.actualFee
      : null;
  const feeAsset =
    typeof raw.feeAsset === "string" && raw.feeAsset.length > 0
      ? raw.feeAsset
      : null;
  return { actualAmount, actualFee, feeAsset };
}

/**
 * Hook for optimized trade execution (#165)
 * - Queues burst trades
 * - Tracks execution time
 * - Polls live slippage during execution
 * - Handles timeout with retry
 */
export function useTradeExecution() {
  const [state, setState] = useState<TradeExecutionState>({
    isExecuting: false,
    result: null,
    error: null,
    executionTimeMs: null,
    estimate: null,
    liveSlippage: 0,
    submittedAmount: null,
    actualAmounts: null,
  });

  const slippagePollRef = useRef<NodeJS.Timeout | null>(null);

  /** Pre-warm caches before user confirms trade */
  const preload = useCallback(async (asset: string, address: string) => {
    await Promise.all([
      tradeExecutionService.getExchangeRate(asset),
      tradeExecutionService.getBalance(address, asset),
    ]);
  }, []);

  const stopSlippagePoll = () => {
    if (slippagePollRef.current) {
      clearInterval(slippagePollRef.current);
      slippagePollRef.current = null;
    }
  };

  const executeTrade = useCallback(async (request: TradeRequest) => {
    const estimate = tradeExecutionService.getEstimate(
      request.slippageTolerance
    );
    // Round to asset precision up front so the value passed to execution
    // matches exactly what is shown in the review/preview.
    const submittedAmount = buildSubmittedAmount(request.amount, request.asset);
    const executedRequest: TradeRequest = {
      ...request,
      amount: submittedAmount.submitted,
    };
    setState((s) => ({
      ...s,
      isExecuting: true,
      error: null,
      result: null,
      estimate,
      submittedAmount,
      actualAmounts: null,
    }));

    // Poll slippage every 500ms during execution
    slippagePollRef.current = setInterval(async () => {
      const rate = await tradeExecutionService.getExchangeRate(request.asset);
      const slippage = Math.abs(rate - request.slippageTolerance) * 100;
      setState((s) => ({
        ...s,
        liveSlippage: parseFloat(slippage.toFixed(2)),
      }));
    }, 500);

    try {
      const result = await tradeExecutionService.enqueue(executedRequest);
      stopSlippagePoll();
      setState((s) => ({
        ...s,
        isExecuting: false,
        result,
        executionTimeMs: result.executionTimeMs,
        error: result.success ? null : result.error ?? "Trade failed",
        actualAmounts: result.success ? extractActualAmounts(result) : null,
      }));
      return result;
    } catch (err) {
      stopSlippagePoll();
      const message = (err as Error).message;
      setState((s) => ({
        ...s,
        isExecuting: false,
        error: message,
        actualAmounts: null,
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    stopSlippagePoll();
    setState({
      isExecuting: false,
      result: null,
      error: null,
      executionTimeMs: null,
      estimate: null,
      liveSlippage: 0,
      submittedAmount: null,
      actualAmounts: null,
    });
  }, []);

  return { ...state, executeTrade, preload, reset };
}
