import { cn } from "@/lib/utils";

interface SignalCardSkeletonProps {
  density?: "comfortable" | "compact";
  animationDelay?: number;
  style?: React.CSSProperties;
  className?: string;
}

// #192: richer skeleton that mirrors SignalCard's structure (header, price grid,
// live-delta box, mini chart, action row) so swapping in real data doesn't shift layout.
// #1037: geometry is aligned with the final card (same paddings, gaps, row heights and
// action sizes) and every placeholder is a plain block — no button-like shapes — so the
// swap causes no layout jump and nothing imitates an interactive control.
export function SignalCardSkeleton({
  density = "comfortable",
  animationDelay,
  style,
  className,
}: SignalCardSkeletonProps = {}) {
  const mergedStyle: React.CSSProperties = {
    ...(animationDelay !== undefined && {
      "--shimmer-delay": `${animationDelay}ms`,
    }),
    ...style,
  };

  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-3xl border border-white/10 bg-slate-900/80",
        density === "compact" ? "p-2 sm:p-3 mb-2" : "p-4 sm:p-6 mb-4",
        className
      )}
      style={mergedStyle}
      role="status"
      aria-label="Loading signal"
    >
      <span className="sr-only">Loading signal…</span>

      {/* #1037: all placeholders are decorative blocks, hidden from assistive tech. */}
      <div aria-hidden="true" className="flex flex-col gap-3">
        {/* header: pair + badges, meta line, bookmark/share slots, action badge */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-6 w-24 rounded bg-surface-high sm:h-7" />
              <div className="h-5 w-16 rounded bg-surface-high" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-4 w-16 rounded bg-surface-high" />
              <div className="h-4 w-10 rounded bg-surface-high" />
              <div className="h-4 w-20 rounded bg-surface-high" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-surface-high" />
            <div className="h-8 w-8 shrink-0 rounded-full bg-surface-high" />
            <div className="h-6 w-16 shrink-0 rounded-full bg-surface-high" />
          </div>
        </div>

        {/* price grid: Execution Price / Confidence / Target / ROI */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1">
              <div className="h-4 w-20 rounded bg-surface-high" />
              <div className="h-5 w-16 rounded bg-surface-high" />
            </div>
          ))}
        </div>

        {/* live delta box */}
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <div className="h-4 w-16 rounded bg-surface-high" />
            <div className="h-8 w-28 rounded-full bg-surface-high" />
          </div>
          <div className="h-3 w-14 self-end rounded bg-surface-high sm:self-center" />
        </div>

        {/* mini chart row, sized to match MiniChart's default 120x40 viewBox */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 shrink-0 rounded bg-surface-high" />
          <div className="h-10 flex-1 rounded-xl bg-surface-high" />
        </div>

        {/* details toggle slot (reserved height, not a control) */}
        <div className="h-8 w-full rounded-xl bg-surface-high" />

        {/* timestamp + keyboard hint row */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-surface-high" />
          <div className="h-4 w-32 rounded bg-surface-high" />
        </div>

        {/* action row: Pass / Execute Trade slots */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 flex-1 rounded-lg bg-surface-high" />
          <div className="h-9 flex-1 rounded-lg bg-surface-high" />
        </div>
      </div>
    </div>
  );
}
