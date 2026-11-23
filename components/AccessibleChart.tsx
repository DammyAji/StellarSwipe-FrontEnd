"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

export interface AccessibleChartSeries {
  /** Stable identifier for the series (e.g. wallet address). */
  id: string;
  /** Human-readable legend label. */
  label: string;
  /** Optional color swatch used by the chart, for legend parity. */
  color?: string;
  /** Optional note, e.g. "history unavailable for part of the period". */
  note?: string;
}

export interface AccessibleChartDataPoint {
  /** Human-readable label for the point (date, day, etc.). */
  label: string;
  /** Value text; omit or pass null when data is unavailable (never "0"). */
  value?: string | null;
  /** Optional series id this point belongs to. */
  seriesId?: string;
  /** Optional text alternative describing the point. */
  description?: string;
}

interface AccessibleChartProps {
  title: string;
  description?: string;
  summary: string;
  children: ReactNode;
  className?: string;
  /** Optional legend descriptors for multi-series charts. */
  series?: AccessibleChartSeries[];
  /** Optional per-point text alternatives for the data summary. */
  dataPoints?: AccessibleChartDataPoint[];
}

export function AccessibleChart({
  title,
  description,
  summary,
  children,
  className = "",
  series,
  dataPoints,
}: AccessibleChartProps) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `chart-details-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const legendId = `${detailsId}-legend`;
  const pointsId = `${detailsId}-points`;
  const describedBy = [
    detailsId,
    series && series.length > 0 ? legendId : null,
    dataPoints && dataPoints.length > 0 ? pointsId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`relative ${className}`}>
      <div
        role="img"
        aria-label={title}
        aria-describedby={describedBy}
      >
        {children}
      </div>

      <div className="sr-only" id={detailsId}>
        <p>{description ? `${description}. ` : ""}{summary}</p>
      </div>

      {series && series.length > 0 && (
        <ul
          id={legendId}
          className="sr-only"
          aria-label={`${title} legend`}
        >
          {series.map((item) => (
            <li key={item.id}>
              {item.label}
              {item.note ? ` (${item.note})` : ""}
            </li>
          ))}
        </ul>
      )}

      {dataPoints && dataPoints.length > 0 && (
        <ul
          id={pointsId}
          className="sr-only"
          aria-label={`${title} data points`}
        >
          {dataPoints.map((point, index) => (
            <li key={`${point.seriesId ?? "point"}-${point.label}-${index}`}>
              {point.label}:{" "}
              {point.value != null && point.value !== ""
                ? point.value
                : "no data available"}
              {point.description ? `. ${point.description}` : ""}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-2 flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <Eye size={14} aria-hidden="true" />
        <span>Chart data summary</span>
        {expanded ? (
          <ChevronUp size={14} aria-hidden="true" />
        ) : (
          <ChevronDown size={14} aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground-muted">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1">{summary}</p>

          {series && series.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-foreground">Legend</p>
              <ul className="mt-1 space-y-1">
                {series.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    {item.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {item.label}
                      {item.note ? ` — ${item.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dataPoints && dataPoints.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-foreground">Data points</p>
              <ul className="mt-1 space-y-1">
                {dataPoints.map((point, index) => (
                  <li key={`${point.seriesId ?? "point"}-${point.label}-${index}`}>
                    <span className="text-foreground">{point.label}</span>
                    {": "}
                    {point.value != null && point.value !== "" ? (
                      point.value
                    ) : (
                      <span className="italic">no data available</span>
                    )}
                    {point.description ? ` — ${point.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
