"use client";

/**
 * SlippageControl (#1102)
 *
 * Per-trade slippage tolerance picker shown in the trade review before the
 * wallet signs. Offers preset buttons (0.1 %, 0.5 %, 1 %, 3 %) and a free-
 * entry custom input. Changing either invalidates or refreshes the quote.
 *
 * Design decisions
 * ─────────────────
 * - Preset buttons are a single `radiogroup` so arrow-key navigation works
 *   without JS and the selected value is always announced.
 * - The custom input has a live validation message (role="alert") and is only
 *   committed on blur / Enter, not on every keystroke, to avoid thrashing the
 *   quote fetcher.
 * - Invalid custom values block confirmation (via the `hasError` output on
 *   `onSlippageChange`) but never hide the presets.
 * - The component is fully controlled: the caller owns the numeric value and
 *   the quote-refresh side-effect.
 */

import { useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SLIPPAGE_PRESETS,
  MAX_SLIPPAGE_PERCENT,
  MIN_SLIPPAGE_PERCENT,
  formatSlippage,
  validateSlippage,
} from "@/lib/trade/slippagePresets";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlippageChangePayload {
  /** Validated numeric value in percent, or null when the custom input is invalid. */
  value: number | null;
  /** True when the custom input contains an invalid string. */
  hasError: boolean;
  /** Human-readable error message, or null when valid. */
  error: string | null;
}

export interface SlippageControlProps {
  /** Currently active slippage value in percent (e.g. 0.5). */
  value: number;
  /** Called whenever the user changes the slippage (preset or custom). */
  onChange: (payload: SlippageChangePayload) => void;
  /**
   * Optional preset values to show as buttons.
   * Defaults to DEFAULT_SLIPPAGE_PRESETS.
   */
  presets?: readonly number[];
  /** True while a quote refresh triggered by a slippage change is in-flight. */
  refreshing?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlippageControl({
  value,
  onChange,
  presets = DEFAULT_SLIPPAGE_PRESETS,
  refreshing = false,
  className,
}: SlippageControlProps) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const hintId = `${groupId}-hint`;

  // "custom" mode: user has clicked "Custom" or typed a value not in presets.
  const isCustom = !presets.includes(value);
  const [customDraft, setCustomDraft] = useState(() =>
    isCustom ? String(value) : ""
  );
  const [customError, setCustomError] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(isCustom);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── handlers ───────────────────────────────────────────────────────────────

  function handlePresetClick(preset: number) {
    setCustomMode(false);
    setCustomDraft("");
    setCustomError(null);
    onChange({ value: preset, hasError: false, error: null });
  }

  function handleCustomButtonClick() {
    setCustomMode(true);
    // Pre-fill with current value only if it's not already a preset.
    setCustomDraft(isCustom ? String(value) : "");
    setCustomError(null);
    // Focus the input on next tick after it renders.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCustomInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setCustomDraft(raw);
    // Clear error while the user is still typing.
    if (customError) setCustomError(null);
  }

  function commitCustomValue() {
    const result = validateSlippage(customDraft);
    if (!result.ok) {
      setCustomError(result.error);
      onChange({ value: null, hasError: true, error: result.error });
    } else {
      setCustomError(null);
      onChange({ value: result.value, hasError: false, error: null });
    }
  }

  function handleCustomKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCustomValue();
    }
    if (e.key === "Escape") {
      // Revert to the last valid preset.
      setCustomMode(false);
      setCustomDraft("");
      setCustomError(null);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-labelledby={`${groupId}-label`}
      className={cn("space-y-2", className)}
    >
      {/* Heading */}
      <div className="flex items-center gap-1.5">
        <span
          id={`${groupId}-label`}
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Slippage tolerance
        </span>
        <span
          id={hintId}
          title={`Maximum price movement you will accept. Must be between ${MIN_SLIPPAGE_PERCENT}% and ${MAX_SLIPPAGE_PERCENT}%.`}
          aria-label={`Slippage tolerance hint: Maximum price movement you will accept. Must be between ${MIN_SLIPPAGE_PERCENT}% and ${MAX_SLIPPAGE_PERCENT}%.`}
        >
          <Info
            className="h-3 w-3 text-muted-foreground opacity-70"
            aria-hidden="true"
          />
        </span>
        {refreshing && (
          <span
            role="status"
            aria-live="polite"
            className="ml-auto text-[11px] text-muted-foreground"
          >
            Refreshing quote…
          </span>
        )}
      </div>

      {/* Preset buttons */}
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={hintId}
        className="flex flex-wrap gap-1.5"
      >
        {presets.map((preset) => {
          const isSelected = !customMode && value === preset;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={refreshing}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {formatSlippage(preset)}
            </button>
          );
        })}

        {/* Custom toggle */}
        <button
          type="button"
          role="radio"
          aria-checked={customMode}
          aria-controls={`${groupId}-input`}
          disabled={refreshing}
          onClick={handleCustomButtonClick}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            customMode
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          Custom
        </button>
      </div>

      {/* Custom input — shown only in custom mode */}
      {customMode && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                id={`${groupId}-input`}
                type="number"
                inputMode="decimal"
                step="0.1"
                min={MIN_SLIPPAGE_PERCENT}
                max={MAX_SLIPPAGE_PERCENT}
                value={customDraft}
                onChange={handleCustomInput}
                onBlur={commitCustomValue}
                onKeyDown={handleCustomKeyDown}
                aria-label="Custom slippage tolerance"
                aria-describedby={
                  customError ? errorId : hintId
                }
                aria-invalid={customError !== null}
                placeholder={`${MIN_SLIPPAGE_PERCENT}–${MAX_SLIPPAGE_PERCENT}`}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-1.5 pr-8 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "placeholder:text-muted-foreground/50",
                  customError
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-input"
                )}
              />
              {/* % suffix */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              >
                %
              </span>
            </div>
          </div>

          {/* Validation message */}
          {customError && (
            <p
              id={errorId}
              role="alert"
              className="text-xs text-destructive"
            >
              {customError}
            </p>
          )}

          {!customError && (
            <p className="text-[11px] text-muted-foreground">
              Enter a value between {MIN_SLIPPAGE_PERCENT}% and{" "}
              {MAX_SLIPPAGE_PERCENT}%, then press Enter or click away.
            </p>
          )}
        </div>
      )}

      {/* Active value summary — shown when not in custom mode */}
      {!customMode && (
        <p
          className="text-[11px] text-muted-foreground"
          aria-live="polite"
        >
          Min. received will be calculated at{" "}
          <strong>{formatSlippage(value)}</strong> tolerance.
        </p>
      )}
    </section>
  );
}
