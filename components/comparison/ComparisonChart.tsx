"use client";

import type { Signal } from "@/lib/api-types.generated";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface ComparisonChartProps {
  signals: Signal[];
}

const COLORS = ["#60a5fa", "#34d399", "#f472b6"];

export function ComparisonChart({ signals }: ComparisonChartProps) {
  if (signals.length === 0) {
    return (
      <EmptyState
        title="No signals to compare yet"
        description="Add two or more signals above to see a side-by-side comparison chart."
        action={
          <Button asChild size="sm" variant="outline">
            <a href="/app">Browse signals</a>
          </Button>
        }
        className="rounded-xl bg-transparent py-6"
      />
    );
  }

  const metrics = [
    { label: "Confidence", getValue: (s: Signal) => s.confidence },
    { label: "R/R Ratio", getValue: (s: Signal) => 0, scale: 10 },
    { label: "Target ∆%", getValue: (s: Signal) => 0, scale: 100 },
  ];

  return (
    <div className="space-y-4">
      {metrics.map(({ label, getValue, scale = 100 }) => {
        const values = signals.map(getValue);
        const maxVal = Math.max(...values, scale * 0.01);
        const unit = label === "Confidence" ? "%" : "";
        return (
          <div
            key={label}
            role="img"
            aria-label={`${label} by asset: ${signals
              .map((s, i) => `${s.ticker} ${values[i].toFixed(1)}${unit}`)
              .join(", ")}`}
          >
            <p className="text-xs text-gray-400 mb-2" id={`comparison-${label}`}>
              {label}
            </p>
            <div className="space-y-1.5" aria-hidden="true">
              {signals.map((signal, i) => {
                const val = values[i];
                const pct = Math.min((val / maxVal) * 100, 100);
                return (
                  <div key={signal.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 w-16 truncate shrink-0">
                      {signal.ticker}
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i] }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-300 w-12 text-right shrink-0">
                      {val.toFixed(1)}{unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
