'use client';

import React, { useMemo, useRef, useState } from 'react';
import AccessibleChart from './AccessibleChart';
import { chartPalette } from '../lib/chartPalette';

export interface DailyReturn {
  date: string; // ISO date string YYYY-MM-DD
  value: number | null; // null means missing/unavailable
}

interface PortfolioReturnsHeatmapProps {
  data: DailyReturn[] | null | undefined;
  loading?: boolean;
  error?: string | null;
  initialMonth?: string; // YYYY-MM
  onMonthChange?: (month: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseMonthKey(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map((v) => parseInt(v, 10));
  return { year: y, month: m - 1 };
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type Bucket = 'missing' | 'zero' | 'positive' | 'negative';

function getBucket(value: number | null | undefined): Bucket {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'missing';
  }
  if (value === 0) {
    return 'zero';
  }
  return value > 0 ? 'positive' : 'negative';
}

function getBucketColor(bucket: Bucket, value: number | null | undefined): string {
  switch (bucket) {
    case 'missing':
      return chartPalette.missing ?? '#e5e7eb';
    case 'zero':
      return chartPalette.neutral ?? '#d1d5db';
    case 'positive': {
      const intensity = Math.min(1, Math.abs(value ?? 0) / 0.03);
      return chartPalette.positiveScale
        ? chartPalette.positiveScale(intensity)
        : chartPalette.positive ?? '#16a34a';
    }
    case 'negative': {
      const intensity = Math.min(1, Math.abs(value ?? 0) / 0.03);
      return chartPalette.negativeScale
        ? chartPalette.negativeScale(intensity)
        : chartPalette.negative ?? '#dc2626';
    }
    default:
      return chartPalette.neutral ?? '#d1d5db';
  }
}

function getBucketLabel(bucket: Bucket, value: number | null | undefined): string {
  switch (bucket) {
    case 'missing':
      return 'No data available';
    case 'zero':
      return 'No change (0.00%)';
    case 'positive':
      return `Gain of ${formatPercent(value ?? 0)}`;
    case 'negative':
      return `Loss of ${formatPercent(value ?? 0)}`;
    default:
      return 'No data available';
  }
}

export default function PortfolioReturnsHeatmap({
  data,
  loading = false,
  error = null,
  initialMonth,
  onMonthChange,
}: PortfolioReturnsHeatmapProps) {
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState<string>(() => {
    if (initialMonth) return initialMonth;
    return toMonthKey(today);
  });
  const gridRef = useRef<HTMLDivElement>(null);

  const valueByDate = useMemo(() => {
    const map = new Map<string, number | null>();
    if (data) {
      for (const entry of data) {
        map.set(entry.date, entry.value);
      }
    }
    return map;
  }, [data]);

  const { year, month } = parseMonthKey(activeMonth);
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const result: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) {
      result.push({ date: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ date: `${year}-${pad(month + 1)}-${pad(d)}`, day: d });
    }
    return result;
  }, [startWeekday, daysInMonth, year, month]);

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;
    let available = 0;
    let missing = 0;
    let zero = 0;
    let positive = 0;
    let negative = 0;
    let sum = 0;
    let best: { date: string; value: number } | null = null;
    let worst: { date: string; value: number } | null = null;
    for (const entry of data) {
      const bucket = getBucket(entry.value);
      if (bucket === 'missing') {
        missing++;
        continue;
      }
      available++;
      const v = entry.value as number;
      sum += v;
      if (bucket === 'zero') zero++;
      else if (bucket === 'positive') positive++;
      else negative++;
      if (best === null || v > best.value) best = { date: entry.date, value: v };
      if (worst === null || v < worst.value) worst = { date: entry.date, value: v };
    }
    return {
      available,
      missing,
      zero,
      positive,
      negative,
      average: available > 0 ? sum / available : 0,
      best,
      worst,
    };
  }, [data]);

  const summaryText = useMemo(() => {
    if (!summary) return 'No portfolio return data available.';
    const parts: string[] = [];
    parts.push(
      `Daily portfolio returns for ${MONTH_NAMES[month]} ${year}.`
    );
    parts.push(`${summary.available} days with data, ${summary.missing} days without data.`);
    parts.push(
      `${summary.positive} positive days, ${summary.negative} negative days, ${summary.zero} flat days.`
    );
    parts.push(`Average daily return ${formatPercent(summary.average)}.`);
    if (summary.best) {
      parts.push(
        `Best day ${formatDateLabel(summary.best.date)} at ${formatPercent(summary.best.value)}.`
      );
    }
    if (summary.worst) {
      parts.push(
        `Worst day ${formatDateLabel(summary.worst.date)} at ${formatPercent(summary.worst.value)}.`
      );
    }
    return parts.join(' ');
  }, [summary, month, year]);

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    const key = toMonthKey(next);
    setActiveMonth(key);
    onMonthChange?.(key);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (!grid) return;
    const focusable = Array.from(
      grid.querySelectorAll<HTMLButtonElement>('[data-day-cell="true"]')
    );
    const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;
    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = Math.min(focusable.length - 1, currentIndex + 1);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(focusable.length - 1, currentIndex + 7);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - 7);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = focusable.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    focusable[nextIndex]?.focus();
  };

  if (loading) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-white p-4"
        role="status"
        aria-live="polite"
      >
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded bg-gray-100"
            />
          ))}
        </div>
        <span className="sr-only">Loading portfolio returns heatmap…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        role="alert"
      >
        <p className="font-medium">Unable to load portfolio returns</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500"
        role="status"
      >
        No portfolio return data available for this period.
      </div>
    );
  }

  return (
    <AccessibleChart
      title={`Daily portfolio returns — ${MONTH_NAMES[month]} ${year}`}
      summary={summaryText}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h3 className="text-sm font-semibold text-gray-900" aria-live="polite">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <div className="min-w-[280px]">
            <div
              className="mb-1 grid grid-cols-7 gap-1"
              role="row"
              aria-hidden="true"
            >
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:text-xs"
                >
                  {wd.slice(0, 1)}
                  <span className="hidden sm:inline">{wd.slice(1)}</span>
                </div>
              ))}
            </div>

            <div
              ref={gridRef}
              className="grid grid-cols-7 gap-1"
              role="grid"
              aria-label={`Calendar heatmap of daily portfolio returns for ${MONTH_NAMES[month]} ${year}`}
              onKeyDown={handleKeyDown}
            >
              {cells.map((cell, idx) => {
                if (!cell.date) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="aspect-square rounded"
                      role="gridcell"
                      aria-hidden="true"
                    />
                  );
                }
                const value = valueByDate.has(cell.date)
                  ? valueByDate.get(cell.date)
                  : null;
                const bucket = getBucket(value);
                const color = getBucketColor(bucket, value);
                const label = getBucketLabel(bucket, value);
                const dateLabel = formatDateLabel(cell.date);
                const ariaLabel = `${dateLabel}: ${label}`;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    data-day-cell="true"
                    role="gridcell"
                    aria-label={ariaLabel}
                    title={ariaLabel}
                    className="group relative aspect-square rounded border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    style={{
                      backgroundColor: color,
                      opacity: bucket === 'missing' ? 0.6 : 1,
                      borderStyle: bucket === 'missing' ? 'dashed' : 'solid',
                      borderColor:
                        bucket === 'missing' ? '#9ca3af' : 'transparent',
                    }}
                  >
                    <span
                      className="absolute left-0.5 top-0.5 text-[9px] font-medium text-gray-700 sm:text-[10px]"
                      aria-hidden="true"
                    >
                      {cell.day}
                    </span>
                    <span className="sr-only">{ariaLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: getBucketColor('positive', 0.03) }}
              aria-hidden="true"
            />
            Gain
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: getBucketColor('negative', -0.03) }}
              aria-hidden="true"
            />
            Loss
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: getBucketColor('zero', 0) }}
              aria-hidden="true"
            />
            Flat
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded border border-dashed border-gray-400"
              style={{
                backgroundColor: getBucketColor('missing', null),
                opacity: 0.6,
              }}
              aria-hidden="true"
            />
            No data
          </span>
        </div>
      </div>
    </AccessibleChart>
  );
}