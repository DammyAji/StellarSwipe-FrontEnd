"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { useRecommendationStore } from "@/store/useRecommendationStore";
import { MarketContextChangeIndicator } from "@/components/MarketContextChangeIndicator";
import { EvidenceLinks } from "@/components/EvidenceLinks";
import type { MarketContextSnapshot } from "@/lib/marketContextChange";
import {
  computeRecommendations,
  recordExplicitFeedback,
} from "@/services/recommendationEngine";
import type { Signal } from "@/lib/api-types.generated";

interface SignalRecommendationsProps {
  signals: Signal[];
  onSelectSignal?: (signal: Signal) => void;
  /** Current quote comparisons keyed by signal ID; absent entries are explicitly unavailable. */
  marketContextBySignalId?: Record<string, MarketContextSnapshot>;
}

/**
 * Personalised signal suggestions in the feed header (#171)
 */
export function SignalRecommendations({
  signals,
  onSelectSignal,
  marketContextBySignalId = {},
}: SignalRecommendationsProps) {
  const { settings, recommendations, feedback, setRecommendations } =
    useRecommendationStore();
  const [submittedFeedback, setSubmittedFeedback] = useState<
    Record<string, "up" | "down">
  >({});

  useEffect(() => {
    if (settings.enabled && settings.privacyAccepted && signals.length > 0) {
      computeRecommendations(signals);
    } else {
      setRecommendations([]);
    }
  }, [
    signals,
    settings.enabled,
    settings.privacyAccepted,
    settings.riskProfile,
  ]);

  const handleFeedback = useCallback(
    (signalId: string, sentiment: "up" | "down") => {
      recordExplicitFeedback(signalId, sentiment);
      setSubmittedFeedback((prev) => ({ ...prev, [signalId]: sentiment }));
      setTimeout(() => {
        setSubmittedFeedback((prev) => {
          const next = { ...prev };
          delete next[signalId];
          return next;
        });
      }, 1500);
    },
    []
  );

  if (
    !settings.enabled ||
    !settings.privacyAccepted ||
    recommendations.length === 0
  )
    return null;

  return (
    <section aria-label="Recommended signals" className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles size={14} className="text-blue-500" />
        <span>Recommended for You</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {recommendations.map((rec) => {
          const signal = signals.find((s) => s.id === rec.signalId);
          if (!signal) return null;
          const userFeedback = feedback.find(
            (f) => f.signalId === rec.signalId
          );
          const justSubmitted = submittedFeedback[rec.signalId];

          return (
            <div
              key={rec.signalId}
              className="shrink-0 rounded-xl border bg-card p-3 w-52 space-y-1.5 cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => onSelectSignal?.(signal)}
              role="group"
              aria-label={`Recommendation: ${signal.ticker} ${signal.action}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSignal?.(signal);
                  }}
                  className="rounded font-semibold text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View recommendation: ${signal.ticker} ${signal.action}`}
                >
                  {signal.ticker}
                </button>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    signal.action === "BUY"
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {signal.action}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                Score:{" "}
                <span className="font-medium text-foreground">{rec.score}</span>
              </div>

              <MarketContextChangeIndicator
                context={marketContextBySignalId[rec.signalId]}
              />

              {/* Supporting evidence links (rendered only when present) */}
              <EvidenceLinks evidence={signal.evidence} />

              {/* Reasons with link to factors page */}
              <div className="space-y-0.5">
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {rec.reasons.slice(0, 2).map((r, i) => (
                    <li key={i} className="flex gap-1">
                      <span>•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/recommendation-factors"
                  onClick={(e) => e.stopPropagation()}
                  className="block text-[10px] text-blue-500 hover:underline"
                  aria-label="Learn why you are seeing this recommendation"
                >
                  Why am I seeing this?
                </Link>
              </div>

              {/* Explicit feedback controls */}
              <div
                className="flex items-center gap-2 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {justSubmitted ? (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      justSubmitted === "up"
                        ? "text-green-500 bg-green-500/10"
                        : "text-red-500 bg-red-500/10"
                    }`}
                    aria-live="polite"
                  >
                    {justSubmitted === "up" ? "Thanks!" : "Got it"}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleFeedback(rec.signalId, "up")}
                      aria-label="Like recommendation"
                      aria-pressed={userFeedback?.liked === true}
                      className={`p-1 rounded hover:bg-green-500/20 transition-colors ${
                        userFeedback?.liked === true
                          ? "text-green-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      onClick={() => handleFeedback(rec.signalId, "down")}
                      aria-label="Dislike recommendation"
                      aria-pressed={userFeedback?.liked === false}
                      className={`p-1 rounded hover:bg-red-500/20 transition-colors ${
                        userFeedback?.liked === false
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
