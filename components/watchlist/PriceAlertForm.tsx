"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePriceAlertStore,
  useAlertsForSymbol,
  type AlertDirection,
  type PriceAlert,
} from "@/store/usePriceAlertStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PriceAlertFormProps {
  /** The asset symbol this form manages alerts for, e.g. "XLM". */
  symbol: string;
  /**
   * Optional price used to prefill the threshold input when creating a new
   * alert (e.g. the signal's current quote price).
   */
  initialThreshold?: number | null;
  /** Called when the user dismisses the panel entirely. */
  onDismiss?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single alert row in the active-alerts list. */
function AlertRow({ alert }: { alert: PriceAlert }) {
  const { openEdit, removeAlert, toggleAlertStatus } = usePriceAlertStore();

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm",
        alert.status === "active"
          ? "border-border bg-surface"
          : "border-border/50 bg-surface/50 opacity-60"
      )}
    >
      <span className="flex-1 truncate">
        <span className="font-medium text-foreground">{alert.symbol}</span>{" "}
        <span className="text-foreground-muted">
          {alert.direction === "above" ? "▲ above" : "▼ below"}{" "}
        </span>
        <span className="font-mono text-foreground">
          ${alert.threshold.toLocaleString()}
        </span>
        {alert.status === "paused" && (
          <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            paused
          </span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => toggleAlertStatus(alert.id)}
          aria-label={alert.status === "active" ? `Pause alert for ${alert.symbol}` : `Resume alert for ${alert.symbol}`}
          title={alert.status === "active" ? "Pause" : "Resume"}
          className="rounded p-1 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {alert.status === "active" ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => openEdit(alert.id)}
          aria-label={`Edit alert for ${alert.symbol}`}
          title="Edit"
          className="rounded p-1 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => removeAlert(alert.id)}
          aria-label={`Remove alert for ${alert.symbol}`}
          title="Remove"
          className="rounded p-1 text-red-400 transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PriceAlertForm
 *
 * Lets users create, edit, pause, and remove price alerts for a watchlist item.
 * The form validates the threshold direction and value before saving, and
 * communicates success, failure, and duplicate-alert states inline.
 *
 * The component is self-contained — it reads and writes to `usePriceAlertStore`
 * directly so it can be dropped into any watchlist item row without threading
 * state through parent components.
 */
export function PriceAlertForm({
  symbol,
  initialThreshold,
  onDismiss,
  className,
}: PriceAlertFormProps) {
  const {
    formState,
    openCreate,
    closeForm,
    dismissResult,
    saveAlert,
  } = usePriceAlertStore();

  const existingAlerts = useAlertsForSymbol(symbol);
  const hasExistingAlerts = existingAlerts.length > 0;

  // Local form inputs — initialised from the alert being edited (if any).
  const editingAlert =
    formState.type === "editing" && formState.alertId
      ? existingAlerts.find((a) => a.id === formState.alertId) ?? null
      : null;

  const [threshold, setThreshold] = useState<string>(
    editingAlert
      ? String(editingAlert.threshold)
      : initialThreshold != null && Number.isFinite(initialThreshold)
        ? String(initialThreshold)
        : ""
  );
  const [direction, setDirection] = useState<AlertDirection>(
    editingAlert ? editingAlert.direction : "above"
  );
  const [touched, setTouched] = useState(false);

  // Sync inputs when a different alert is opened for editing.
  useEffect(() => {
    if (formState.type === "editing") {
      setThreshold(
        editingAlert
          ? String(editingAlert.threshold)
          : initialThreshold != null && Number.isFinite(initialThreshold)
            ? String(initialThreshold)
            : ""
      );
      setDirection(editingAlert ? editingAlert.direction : "above");
      setTouched(false);
    }
  }, [formState, editingAlert, initialThreshold]);

  const thresholdId = useId();
  const directionId = useId();
  const thresholdInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the threshold input when the form opens.
  useEffect(() => {
    if (formState.type === "editing") {
      thresholdInputRef.current?.focus();
    }
  }, [formState.type]);

  // --- Inline validation ---
  const numericThreshold = parseFloat(threshold);
  const isThresholdValid =
    threshold.trim() !== "" &&
    Number.isFinite(numericThreshold) &&
    numericThreshold > 0;
  const showThresholdError = touched && !isThresholdValid;
  const thresholdErrorId = `${thresholdId}-error`;

  // --- Submit ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isThresholdValid) return;

    saveAlert({
      symbol,
      threshold: numericThreshold,
      direction,
      editingId: editingAlert?.id ?? null,
    });
  };

  const isEditing = formState.type === "editing";
  const isEditingExisting = isEditing && formState.alertId !== null;

  // ---------------------------------------------------------------------------
  // Render helpers for each form state
  // ---------------------------------------------------------------------------

  if (formState.type === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-green-400" size={18} aria-hidden="true" />
          <p className="text-sm text-green-300">{formState.message}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={dismissResult}
            className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 transition-colors hover:bg-green-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => openCreate(symbol)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  if (formState.type === "failure") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-400" size={18} aria-hidden="true" />
          <p className="text-sm text-red-300">{formState.message}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openCreate(symbol)}
            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={dismissResult}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (formState.type === "duplicate") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={18} aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-300">Duplicate alert</p>
            <p className="mt-0.5 text-xs text-amber-300/80">
              You already have an active alert for{" "}
              <strong>{formState.symbol}</strong>{" "}
              {formState.direction === "above" ? "above" : "below"} $
              {formState.threshold.toLocaleString()}.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openCreate(symbol)}
            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Change threshold
          </button>
          <button
            type="button"
            onClick={dismissResult}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Default idle view — shows the alert list + action to create new
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Existing alerts list */}
      {existingAlerts.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            Active alerts for {symbol}
          </p>
          <ul className="flex flex-col gap-1.5" aria-label={`Price alerts for ${symbol}`}>
            {existingAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </div>
      )}

      {/* Form — shown when editing or always when there are no alerts */}
      {(isEditing || existingAlerts.length === 0) && (
        <form
          onSubmit={handleSubmit}
          aria-label={isEditingExisting ? `Edit price alert for ${symbol}` : `Set price alert for ${symbol}`}
          noValidate
        >
          <fieldset className="rounded-2xl border border-border bg-surface p-4">
            <legend className="mb-3 text-sm font-semibold text-foreground">
              {isEditingExisting ? `Edit alert — ${symbol}` : `New alert — ${symbol}`}
            </legend>

            <div className="flex flex-col gap-3">
              {/* Direction selector */}
              <div>
                <label htmlFor={directionId} className="mb-1 block text-xs font-medium text-foreground-muted">
                  Notify me when price goes
                </label>
                <select
                  id={directionId}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as AlertDirection)}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="above">Above threshold</option>
                  <option value="below">Below threshold</option>
                </select>
              </div>

              {/* Threshold input */}
              <div>
                <label htmlFor={thresholdId} className="mb-1 block text-xs font-medium text-foreground-muted">
                  Price threshold (USD)
                </label>
                <input
                  ref={thresholdInputRef}
                  id={thresholdId}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={threshold}
                  onChange={(e) => {
                    setThreshold(e.target.value);
                    if (!touched) setTouched(false);
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder="e.g. 0.15"
                  aria-invalid={showThresholdError}
                  aria-describedby={showThresholdError ? thresholdErrorId : undefined}
                  className={cn(
                    "w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder-foreground-subtle focus:outline-none focus:ring-2 focus:ring-blue-500",
                    showThresholdError ? "border-red-500" : "border-border"
                  )}
                />
                {showThresholdError && (
                  <p
                    id={thresholdErrorId}
                    role="alert"
                    className="mt-1 text-xs text-red-400"
                  >
                    Enter a positive price, e.g. 0.15.
                  </p>
                )}
              </div>

              {/* Preview */}
              {isThresholdValid && (
                <p className="text-xs text-foreground-muted" aria-live="polite">
                  You&apos;ll be notified when <strong className="text-foreground">{symbol}</strong> goes{" "}
                  <strong className="text-foreground">{direction}</strong>{" "}
                  <strong className="font-mono text-foreground">${numericThreshold.toLocaleString()}</strong>.
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!isThresholdValid}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEditingExisting ? "Save changes" : "Set alert"}
                </button>
                {(isEditing || onDismiss) && (
                  <button
                    type="button"
                    onClick={isEditing ? closeForm : onDismiss}
                    aria-label="Cancel"
                    className="rounded-lg border border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        </form>
      )}

      {/* "Add alert" trigger — shown in idle state when alerts already exist */}
      {!isEditing && existingAlerts.length > 0 && (
        <button
          type="button"
          onClick={() => openCreate(symbol)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Bell size={13} aria-hidden="true" />
          Add another alert
        </button>
      )}

      {/* Dismiss the panel */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1 self-end text-xs text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close price alerts panel"
        >
          <X size={12} aria-hidden="true" />
          Close
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger button — a drop-in for watchlist item rows
// ---------------------------------------------------------------------------

interface PriceAlertTriggerProps {
  symbol: string;
  className?: string;
}

/**
 * PriceAlertTrigger
 *
 * A compact button suitable for embedding in a watchlist item row.
 * Indicates whether the asset already has active alerts.
 * Clicking opens `PriceAlertForm` for the given symbol via the store.
 */
export function PriceAlertTrigger({ symbol, className }: PriceAlertTriggerProps) {
  const { openCreate } = usePriceAlertStore();
  const alerts = useAlertsForSymbol(symbol);
  const activeCount = alerts.filter((a) => a.status === "active").length;

  return (
    <button
      type="button"
      onClick={() => openCreate(symbol)}
      aria-label={
        activeCount > 0
          ? `${activeCount} active price alert${activeCount > 1 ? "s" : ""} for ${symbol} — click to manage`
          : `Set price alert for ${symbol}`
      }
      title={activeCount > 0 ? `${activeCount} alert${activeCount > 1 ? "s" : ""}` : "Set alert"}
      className={cn(
        "relative flex items-center justify-center rounded-lg p-1.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        activeCount > 0
          ? "text-blue-400 hover:text-blue-300"
          : "text-foreground-muted hover:text-foreground",
        className
      )}
    >
      {activeCount > 0 ? (
        <Bell size={16} aria-hidden="true" />
      ) : (
        <BellOff size={16} aria-hidden="true" />
      )}
      {activeCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white"
        >
          {activeCount > 9 ? "9+" : activeCount}
        </span>
      )}
    </button>
  );
}
