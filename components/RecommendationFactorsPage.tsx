"use client";

import {
  RECOMMENDATION_FACTORS,
  type RecommendationFactor,
} from "@/services/recommendationEngine";
import { useRecommendationStore } from "@/store/useRecommendationStore";
import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { RecommendationFactorDrawer } from "@/components/RecommendationFactorDrawer";

type FactorWithEvidence = RecommendationFactor & {
  evidence?: { label: string; url: string }[];
};

function getFactorEvidence(factor: RecommendationFactor) {
  const evidence = (factor as FactorWithEvidence).evidence;
  if (!Array.isArray(evidence)) return [];
  return evidence.filter(
    (item) =>
      item &&
      typeof item.label === "string" &&
      item.label.trim().length > 0 &&
      typeof item.url === "string" &&
      item.url.trim().length > 0,
  );
}

export function RecommendationFactorsPage() {
  const { settings } = useRecommendationStore();
  const [openFactorId, setOpenFactorId] = useState<string | null>(null);
  const openFactor =
    RECOMMENDATION_FACTORS.find((factor) => factor.id === openFactorId) ?? null;
  const openFactorEvidence = openFactor ? getFactorEvidence(openFactor) : [];

  return (
    <section className="space-y-5 max-w-lg">
      <div>
        <h2 className="text-base font-semibold">Why Am I Seeing This?</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Recommendations are scored locally using these factors. Your current
          risk profile is{" "}
          <span className="font-medium capitalize">{settings.riskProfile}</span>
          .
        </p>
      </div>

      <ul className="space-y-3" aria-label="Recommendation factors">
        {RECOMMENDATION_FACTORS.map((factor) => {
          const evidence = getFactorEvidence(factor);
          return (
            <li key={factor.id}>
              <button
                type="button"
                onClick={() => setOpenFactorId(factor.id)}
                aria-haspopup="dialog"
                className="w-full rounded-lg border bg-card p-3 space-y-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{factor.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {factor.weight}
                    </span>
                    <ChevronRight
                      size={14}
                      className="text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {factor.description}
                </p>
                {evidence.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Evidence:</span>{" "}
                    {evidence.map((item, index) => (
                      <span key={`${factor.id}-${item.url}`}>
                        {index > 0 && ", "}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        >
                          {item.label}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <RecommendationFactorDrawer
        factorId={openFactorId}
        riskProfile={settings.riskProfile}
        evidence={openFactorEvidence}
        onClose={() => setOpenFactorId(null)}
      />

      <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
        <Info
          size={13}
          className="mt-0.5 shrink-0 text-blue-400"
          aria-hidden="true"
        />
        <span>
          All scoring happens in your browser. No personal data leaves your
          device. You can adjust your risk profile in{" "}
          <a href="/app" className="text-blue-500 hover:underline">
            Recommendation Settings
          </a>
          .
        </span>
      </div>
    </section>
  );
}
