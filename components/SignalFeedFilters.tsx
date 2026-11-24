"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ListFilter,
  Save,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/types";
import {
  FilterDirection,
  FilterScope,
  useSignalFilterStore,
  useSignalFilterHydrated,
} from "@/store/useSignalFilterStore";
import { SavedFiltersPanel } from "@/components/SavedFiltersPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSegmentedControlKeyboard } from "@/hooks/useSegmentedControlKeyboard";

const DIRECTIONS: { label: string; value: FilterDirection }[] = [
  { label: "All", value: "ALL" },
  { label: "Buy", value: "BUY" },
  { label: "Sell", value: "SELL" },
];

const SCOPES: { label: string; value: FilterScope }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Archived", value: "ARCHIVED" },
  { label: "All", value: "ALL" },
];

interface SignalFeedFiltersProps {
  /** Unique asset names derived from the current signal list */
  availableAssets?: string[];
  /** Unique provider names derived from the current signal list */
  availableProviders?: string[];
  /** Current (unfiltered) signal dataset, used to derive per-option result counts */
  signals?: Signal[];
  /** Whether the signal dataset is still loading — shows a loading state for counts */
  isLoadingCounts?: boolean;
  /**
   * Total signals surviving ALL active filters — displayed next to the heading
   * so users immediately know how many results their choices produce.
   */
  filteredCount?: number;
  /**
   * Ref forwarded to the first focusable filter control.
   * Allows parent code (e.g. a keyboard shortcut) to programmatically focus the
   * filter section without triggering a search or submit action.
   */
  filterFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

/** Small badge that renders a per-option result count with distinct loading/empty/unavailable states */
function CountBadge({
  count,
  isLoading,
}: {
  count: number | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <span
        className="ml-1.5 inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent align-middle opacity-60"
        aria-hidden="true"
      />
    );
  }
  if (count === null) {
    return (
      <span className="ml-1 text-[10px] opacity-40" aria-hidden="true">
        &ndash;
      </span>
    );
  }
  return (
    <span
      className={cn(
        "ml-1 text-[10px] tabular-nums transition-opacity",
        count === 0 ? "opacity-40" : "opacity-80"
      )}
    >
      ({count})
    </span>
  );
}

const MAX_QUICK_FILTERS = 4;

export function SignalFeedFilters({
  availableAssets = [],
  availableProviders = [],
  signals,
  isLoadingCounts = false,
  filteredCount,
  filterFocusRef,
}: SignalFeedFiltersProps) {
  const {
    direction,
    asset,
    provider,
    scope,
    bookmarkedOnly,
    followedOnly,
    presets,
    setDirection,
    setAsset,
    setProvider,
    setScope,
    setBookmarkedOnly,
    setFollowedOnly,
    savePreset,
    applyPreset,
    deletePreset,
    reset,
  } = useSignalFilterStore();
  const isHydrated = useSignalFilterHydrated();
  const assetInputRef = useRef<HTMLInputElement>(null);
  // Ref for the first focusable filter control — used by the keyboard shortcut.
  const firstFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [presetName, setPresetName] = useState("");
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);

  // Roving tabindex + arrow-key navigation for the scope segmented control.
  const scopeKeyboard = useSegmentedControlKeyboard({
    count: SCOPES.length,
    selectedIndex: Math.max(
      0,
      SCOPES.findIndex((s) => s.value === scope)
    ),
  });

  // F — focus the filter section without triggering any search or submit.
  // Does not fire while the user is typing in a text field (handled by
  // useKeyboardShortcuts). Scrolls the control into view for keyboard users.
  useKeyboardShortcuts([
    {
      key: "f",
      callback: () => {
        const el = firstFilterButtonRef.current ?? filterFocusRef?.current;
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        el.focus();
      },
    },
  ]);

  const counts = useMemo(() => {
    if (!signals) return null;
    return {
      direction: (value: FilterDirection) =>
        value === "ALL"
          ? signals.length
          : signals.filter((s) => s.direction === value).length,
      asset: (value: string) =>
        signals.filter((s) => s.asset === value).length,
      provider: (value: string) =>
        signals.filter((s) => s.providerId === value).length,
    };
  }, [signals]);

  // Render a neutral placeholder until persisted filters are loaded.
  // This prevents filter state from flickering from defaults to saved values.
  if (!isHydrated) {
    return (
      <section
        aria-label="Signal feed filters"
        role="status"
        aria-busy="true"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:p-4"
      >
        <span className="sr-only">Loading filters…</span>
        <div
          aria-hidden="true"
          className="h-4 w-16 rounded bg-surface-high animate-pulse"
        />
        <div aria-hidden="true" className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-16 rounded-full bg-surface-high animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  const isActive =
    direction !== "ALL" ||
    asset !== "" ||
    provider !== "" ||
    scope !== "ACTIVE" ||
    bookmarkedOnly ||
    followedOnly;

  /** Count of individual active criteria — used in the active-filter summary badge */
  const activeFilterCount = [
    direction !== "ALL",
    asset !== "",
    provider !== "",
    scope !== "ACTIVE",
    bookmarkedOnly,
    followedOnly,
  ].filter(Boolean).length;

  const quickAssets = availableAssets.slice(0, MAX_QUICK_FILTERS);
  const quickProviders = availableProviders.slice(0, MAX_QUICK_FILTERS);

  return (
    <section
      aria-label="Signal feed filters"
      aria-description="Press F to focus filters"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:p-4 transition-shadow"
    >
      {/* Title row — sticky on larger viewports */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-foreground-muted uppercase tracking-wide">
          <SlidersHorizontal size={13} aria-hidden="true" />
          Filters
          {/* Active-filter count badge */}
          {activeFilterCount > 0 && (
            <span
              aria-label={`${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`}
              className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white tabular-nums transition-all duration-200"
            >
              {activeFilterCount}
            </span>
          )}
          {/* Live result count */}
          {filteredCount !== undefined && (
            <span
              aria-live="polite"
              aria-atomic="true"
              className={cn(
                "text-[11px] font-normal tabular-nums transition-colors",
                filteredCount === 0
                  ? "text-amber-400/80"
                  : "text-foreground-muted"
              )}
            >
              — {filteredCount} result{filteredCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSavedFiltersOpen((v) => !v)}
            aria-expanded={savedFiltersOpen}
            aria-controls="saved-filters-panel"
            className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
          >
            <ListFilter size={12} />
            Saved filters
          </button>
          {isActive && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              aria-label="Clear all filters"
            >
              <X size={12} />
              Clear all
            </button>
          )}
        </div>
      </div>

      {savedFiltersOpen && (
        <div id="saved-filters-panel">
          <SavedFiltersPanel />
        </div>
      )}

      {/* Signal scope — Active / Archived / All. Stacked on narrow screens. */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span
          id="signal-scope-label"
          className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide"
        >
          Signals
        </span>
        <div
          role="radiogroup"
          aria-labelledby="signal-scope-label"
          aria-description="Use arrow keys to switch between active, archived, and all signals"
          className="inline-flex w-full rounded-full border border-border bg-surface p-0.5 sm:w-auto"
        >
          {SCOPES.map(({ label, value }, idx) => {
            const isSelected = scope === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={scopeKeyboard.getTabIndex(idx)}
                onClick={() => setScope(value)}
                onKeyDown={(e) => scopeKeyboard.handleKeyDown(e, idx)}
                className={cn(
                  "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface sm:flex-none",
                  isSelected
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/50"
                    : "border border-transparent text-foreground-muted hover:text-foreground hover:bg-surface-high/20"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick-filter pills — bookmarked + followed + asset + provider shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
          aria-pressed={bookmarkedOnly}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            bookmarkedOnly
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-[0_0_0_1px] shadow-sky-500/20"
              : "bg-white/5 text-gray-300 border border-white/10 hover:border-white/20 hover:text-gray-200 hover:bg-white/8"
          )}
        >
          <Bookmark size={12} aria-hidden="true" />
          Bookmarked
        </button>

        <button
          type="button"
          onClick={() => setFollowedOnly(!followedOnly)}
          aria-pressed={followedOnly}
          aria-label="Show followed providers only"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            followedOnly
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-[0_0_0_1px] shadow-sky-500/20"
              : "bg-white/5 text-gray-300 border border-white/10 hover:border-white/20 hover:text-gray-200 hover:bg-white/8"
          )}
        >
          <Users size={12} aria-hidden="true" />
          Followed
        </button>

        {quickAssets.map((assetLabel) => {
          const count = counts ? counts.asset(assetLabel) : null;
          const isSelected = asset === assetLabel;
          return (
            <button
              key={assetLabel}
              type="button"
              onClick={() => setAsset(isSelected ? "" : assetLabel)}
              aria-pressed={isSelected}
              aria-label={`Filter by asset ${assetLabel}${count !== null ? `, ${count} results` : ""}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isSelected
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_0_1px] shadow-emerald-500/20"
                  : "bg-surface text-foreground border border-border hover:border-border-strong hover:text-foreground hover:bg-surface-high/20"
              )}
            >
              {assetLabel}
              <CountBadge count={count} isLoading={isLoadingCounts} />
            </button>
          );
        })}

        {quickProviders.map((providerLabel) => {
          const count = counts ? counts.provider(providerLabel) : null;
          const isSelected = provider === providerLabel;
          return (
            <button
              key={providerLabel}
              type="button"
              onClick={() => setProvider(isSelected ? "" : providerLabel)}
              aria-pressed={isSelected}
              aria-label={`Filter by provider ${providerLabel}${count !== null ? `, ${count} results` : ""}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isSelected
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/50 shadow-[0_0_0_1px] shadow-orange-500/20"
                  : "bg-surface text-foreground border border-border hover:border-border-strong hover:text-foreground hover:bg-surface-high/20"
              )}
            >
              {providerLabel}
              <CountBadge count={count} isLoading={isLoadingCounts} />
            </button>
          );
        })}
      </div>

      {/* Direction + asset + provider selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Direction pills */}
        <fieldset className="flex items-center gap-1" aria-label="Filter by direction">
          {DIRECTIONS.map(({ label, value }, idx) => {
            const count = counts ? counts.direction(value) : null;
            const isSelected = direction === value;
            return (
              <button
                key={value}
                ref={idx === 0 ? (el) => {
                  (firstFilterButtonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                  if (filterFocusRef && idx === 0) {
                    (filterFocusRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                  }
                } : undefined}
                onClick={() => setDirection(value)}
                aria-pressed={isSelected}
                aria-label={`Filter by direction ${label}${count !== null ? `, ${count} results` : ""}`}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  isSelected
                    ? value === "BUY"
                      ? "bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_0_1px] shadow-green-500/20"
                      : value === "SELL"
                      ? "bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_0_1px] shadow-red-500/20"
                      : "bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_0_1px] shadow-blue-500/20"
                    : "bg-surface text-foreground-muted border border-border hover:border-border-strong hover:text-foreground hover:bg-surface-high/20"
                )}
              >
                {label}
                <CountBadge count={count} isLoading={isLoadingCounts} />
              </button>
            );
          })}
        </fieldset>

        {/* Asset filter */}
        <div className="relative flex items-center">
          {availableAssets.length > 0 ? (
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              aria-label="Filter by asset"
              className="appearance-none rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-white/20 transition-colors pr-6"
            >
              <option value="">
                All assets
                {counts ? ` (${counts.direction("ALL")})` : ""}
              </option>
              {availableAssets.map((a) => (
                <option key={a} value={a}>
                  {a}
                  {counts ? ` (${counts.asset(a)})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="relative">
              <input
                ref={assetInputRef}
                type="text"
                value={asset}
                onChange={(e) => setAsset(e.target.value.toUpperCase())}
                placeholder="Asset (e.g. XLM)"
                aria-label="Filter by asset"
                maxLength={10}
                className="rounded-full bg-surface border border-border pl-3 pr-8 py-1 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-border-strong transition-colors w-32"
              />
              {asset && (
                <button
                  type="button"
                  onClick={() => {
                    setAsset("");
                    assetInputRef.current?.focus();
                  }}
                  title="Clear asset filter"
                  aria-label="Clear asset filter"
                  className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-gray-500 hover:text-gray-300"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {availableProviders.length > 0 && (
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            aria-label="Filter by provider"
            className="appearance-none rounded-full bg-surface border border-border px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-border-strong transition-colors"
          >
            <option value="">All providers</option>
            {availableProviders.map((p) => (
              <option key={p} value={p}>
                {p}
                {counts ? ` (${counts.provider(p)})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Active filter summary — polite live region */}
      {isActive && (
        <p className="text-[11px] text-gray-500" aria-live="polite">
          Showing:{" "}
          {[
            scope !== "ACTIVE" &&
              `Signals: ${SCOPES.find((s) => s.value === scope)?.label ?? scope}`,
            direction !== "ALL" && `Direction: ${direction}`,
            asset && `Asset: ${asset}`,
            provider && `Provider: ${provider}`,
            bookmarkedOnly && `Bookmarked only`,
            followedOnly && `Followed providers only`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* Presets */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide">
            Presets
          </span>
          <button
            type="button"
            onClick={() => setShowPresetInput((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
            aria-label="Save current filters as preset"
          >
            <Save size={11} />
            Save current
          </button>
        </div>

        {showPresetInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = presetName.trim();
              if (!name) return;
              savePreset(name);
              setPresetName("");
              setShowPresetInput(false);
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name…"
              maxLength={40}
              className="flex-1 rounded-full bg-surface border border-border px-3 py-1 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Preset name"
            />
            <button
              type="submit"
              disabled={!presetName.trim()}
              className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowPresetInput(false)}
              className="rounded-full px-3 py-1 text-xs text-foreground-muted hover:text-foreground border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Cancel
            </button>
          </form>
        )}

        {presets.length > 0 && (
          <ul
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Saved filter presets"
          >
            {presets.map((preset) => (
              <li key={preset.name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(preset.name)}
                  className="rounded-full bg-surface border border-border px-3 py-1 text-xs text-foreground hover:border-blue-500/60 hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title={`Apply preset: ${preset.name}`}
                  aria-label={`Apply preset: ${preset.name}`}
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(preset.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  title={`Delete preset: ${preset.name}`}
                  aria-label={`Delete preset: ${preset.name}`}
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
