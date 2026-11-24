"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FilterDirection,
  FilterScope,
  useSignalFilterStore,
} from "@/store/useSignalFilterStore";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const DIRECTIONS: { label: string; value: FilterDirection }[] = [
  { label: "All", value: "ALL" },
  { label: "Buy", value: "BUY" },
  { label: "Sell", value: "SELL" },
];

const TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const SCOPES: { label: string; value: FilterScope }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
  { label: "All", value: "ALL" },
];

interface SignalFilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  availableProviders?: string[];
  availableMarkets?: string[];
  /** Currently selected timeframe */
  timeframe?: Timeframe;
  onTimeframeChange?: (t: Timeframe) => void;
}

export function SignalFilterBottomSheet({
  open,
  onClose,
  availableProviders = [],
  availableMarkets = [],
  timeframe = "1d",
  onTimeframeChange,
}: SignalFilterBottomSheetProps) {
  const store = useSignalFilterStore();

  // Edits are made against a local draft so the feed underneath doesn't
  // re-filter while the user is still choosing. Apply commits the draft;
  // Cancel / Escape / backdrop / swipe-down discard it.
  const [direction, setDirection] = useState<FilterDirection>(store.direction);
  const [scope, setScope] = useState<FilterScope>(store.scope);
  const [asset, setAsset] = useState(store.asset);
  const [provider, setProvider] = useState(store.provider);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(store.bookmarkedOnly);
  const [followedOnly, setFollowedOnly] = useState(store.followedOnly);
  const [draftTimeframe, setDraftTimeframe] = useState<Timeframe>(timeframe);

  useEffect(() => {
    if (!open) return;
    const current = useSignalFilterStore.getState();
    setDirection(current.direction);
    setScope(current.scope);
    setAsset(current.asset);
    setProvider(current.provider);
    setBookmarkedOnly(current.bookmarkedOnly);
    setFollowedOnly(current.followedOnly);
    setDraftTimeframe(timeframe);
  }, [open, timeframe]);

  const isActive =
    direction !== "ALL" ||
    scope !== "ACTIVE" ||
    asset !== "" ||
    provider !== "" ||
    bookmarkedOnly ||
    followedOnly;

  const handleReset = () => {
    // Reset only clears the draft — nothing changes until Apply.
    setDirection("ALL");
    setScope("ACTIVE");
    setAsset("");
    setProvider("");
    setBookmarkedOnly(false);
    setFollowedOnly(false);
  };

  const handleApply = () => {
    store.setDirection(direction);
    store.setScope(scope);
    store.setAsset(asset);
    store.setProvider(provider);
    store.setBookmarkedOnly(bookmarkedOnly);
    store.setFollowedOnly(followedOnly);
    if (draftTimeframe !== timeframe) onTimeframeChange?.(draftTimeframe);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="Signal feed filters"
      initialFocus='button[aria-label="Close"]'
      title={
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters
        </span>
      }
      headerExtra={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
            aria-pressed={bookmarkedOnly}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
              bookmarkedOnly
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                : "bg-white/5 text-slate-300 border border-white/10 hover:border-white/20 hover:text-white"
            )}
          >
            Bookmarked
          </button>
          <button
            type="button"
            onClick={() => setFollowedOnly(!followedOnly)}
            aria-pressed={followedOnly}
            aria-label="Show followed providers only"
            className={cn(
              "rounded-full px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
              followedOnly
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/40"
                : "bg-white/5 text-slate-300 border border-white/10 hover:border-white/20 hover:text-white"
            )}
          >
            Followed
          </button>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isActive}
            aria-label="Reset all filters"
            className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-[1.5] rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 active:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Apply filters
          </button>
        </div>
      }
    >
      <div className="px-4 pb-4 space-y-5">
        {/* Scope row */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Signals
                </p>
                <div
                  role="group"
                  aria-label="Filter by signal status"
                  className="flex gap-2"
                >
                  {SCOPES.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      aria-pressed={scope === value}
                      className={cn(
                        "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                        scope === value
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

        {/* Direction row */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Direction
                </p>
                <div
                  role="group"
                  aria-label="Filter by direction"
                  className="flex gap-2"
                >
                  {DIRECTIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDirection(value)}
                      aria-pressed={direction === value}
                      className={cn(
                        "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                        direction === value
                          ? value === "BUY"
                            ? "bg-green-500/20 text-green-400 border border-green-500/40"
                            : value === "SELL"
                            ? "bg-red-500/20 text-red-400 border border-red-500/40"
                            : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider row */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Provider
                </p>
                {availableProviders.length > 0 ? (
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    aria-label="Filter by provider"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-white/20 transition-colors"
                  >
                    <option value="">All providers</option>
                    {availableProviders.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    placeholder="Search provider…"
                    aria-label="Filter by provider"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-white/20 transition-colors"
                  />
                )}
              </div>

              {/* Market row */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Market
                </p>
                {availableMarkets.length > 0 ? (
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    aria-label="Filter by market"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-white/20 transition-colors"
                  >
                    <option value="">All markets</option>
                    {availableMarkets.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={asset}
                    onChange={(e) => setAsset(e.target.value.toUpperCase())}
                    placeholder="e.g. XLM"
                    aria-label="Filter by market"
                    maxLength={10}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 hover:border-white/20 transition-colors"
                  />
                )}
              </div>

              {/* Timeframe row */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Timeframe
                </p>
                <div
                  role="group"
                  aria-label="Filter by timeframe"
                  className="flex gap-2"
                >
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setDraftTimeframe(tf)}
                      aria-pressed={draftTimeframe === tf}
                      className={cn(
                        "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                        draftTimeframe === tf
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20"
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active filter summary */}
              {isActive && (
                <p className="text-xs text-slate-500" aria-live="polite">
                  Pending:{" "}
                  {[
                    scope !== "ACTIVE" &&
                      `Signals: ${
                        scope === "ARCHIVED" ? "Archived" : "Active + Archived"
                      }`,
                    direction !== "ALL" && `Direction: ${direction}`,
                    asset && `Market: ${asset}`,
                    provider && `Provider: ${provider}`,
                    followedOnly && `Followed providers only`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

      </div>
    </BottomSheet>
  );
}
