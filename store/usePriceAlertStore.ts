import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AlertDirection = "above" | "below";

export type AlertStatus = "active" | "triggered" | "paused";

export interface PriceAlert {
  id: string;
  /** Asset symbol, e.g. "XLM" */
  symbol: string;
  /** Price threshold that triggers the alert */
  threshold: number;
  /** Whether the alert fires when price goes above or below the threshold */
  direction: AlertDirection;
  /** Current lifecycle state */
  status: AlertStatus;
  /** ISO timestamp when the alert was created */
  createdAt: string;
  /** ISO timestamp when the alert was last modified */
  updatedAt: string;
}

export type AlertFormState =
  | { type: "idle" }
  | { type: "editing"; alertId: string | null; symbol: string }
  | { type: "success"; message: string }
  | { type: "failure"; message: string }
  | { type: "duplicate"; symbol: string; direction: AlertDirection; threshold: number };

interface PriceAlertState {
  alerts: PriceAlert[];
  formState: AlertFormState;

  /** Open the form to create a new alert for the given asset symbol. */
  openCreate: (symbol: string) => void;
  /**
   * Open the form to edit an existing alert.
   * If `alertId` doesn't exist the form is opened in creation mode.
   */
  openEdit: (alertId: string) => void;
  /** Reset the form back to idle without saving. */
  closeForm: () => void;
  /** Dismiss a terminal success / failure / duplicate state back to idle. */
  dismissResult: () => void;

  /**
   * Save a new or edited alert.
   *
   * Validates:
   * - `threshold` must be a positive finite number
   * - A duplicate is an alert with the same symbol+direction+threshold that is
   *   already active — in that case the store transitions to the "duplicate"
   *   state instead of saving.
   *
   * On success transitions to "success". On unexpected error transitions to
   * "failure".  Returns `true` on save, `false` on validation/duplicate.
   */
  saveAlert: (params: {
    symbol: string;
    threshold: number;
    direction: AlertDirection;
    editingId?: string | null;
  }) => boolean;

  /** Remove an alert by id. */
  removeAlert: (id: string) => void;

  /** Toggle an alert between "active" and "paused". */
  toggleAlertStatus: (id: string) => void;
}

function generateId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const usePriceAlertStore = create<PriceAlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      formState: { type: "idle" },

      openCreate: (symbol) =>
        set({ formState: { type: "editing", alertId: null, symbol } }),

      openEdit: (alertId) => {
        const alert = get().alerts.find((a) => a.id === alertId);
        if (!alert) {
          // Gracefully fall back to idle if the alert doesn't exist.
          set({ formState: { type: "idle" } });
          return;
        }
        set({ formState: { type: "editing", alertId, symbol: alert.symbol } });
      },

      closeForm: () => set({ formState: { type: "idle" } }),

      dismissResult: () => set({ formState: { type: "idle" } }),

      saveAlert: ({ symbol, threshold, direction, editingId }) => {
        // --- Validation ---
        if (!Number.isFinite(threshold) || threshold <= 0) {
          set({
            formState: {
              type: "failure",
              message: "Threshold must be a positive number.",
            },
          });
          return false;
        }

        // --- Duplicate detection ---
        const duplicate = get().alerts.find(
          (a) =>
            a.id !== (editingId ?? "") &&
            a.symbol === symbol &&
            a.direction === direction &&
            a.threshold === threshold &&
            a.status === "active"
        );
        if (duplicate) {
          set({
            formState: { type: "duplicate", symbol, direction, threshold },
          });
          return false;
        }

        const now = new Date().toISOString();

        if (editingId) {
          // --- Edit existing ---
          set((state) => ({
            alerts: state.alerts.map((a) =>
              a.id === editingId
                ? { ...a, symbol, threshold, direction, updatedAt: now }
                : a
            ),
            formState: {
              type: "success",
              message: `Alert for ${symbol} updated.`,
            },
          }));
        } else {
          // --- Create new ---
          const newAlert: PriceAlert = {
            id: generateId(),
            symbol,
            threshold,
            direction,
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
          set((state) => ({
            alerts: [...state.alerts, newAlert],
            formState: {
              type: "success",
              message: `Alert set: notify when ${symbol} goes ${direction} $${threshold.toLocaleString()}.`,
            },
          }));
        }

        return true;
      },

      removeAlert: (id) =>
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

      toggleAlertStatus: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: a.status === "active" ? "paused" : "active",
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
        })),
    }),
    { name: "price-alert-store" }
  )
);

/**
 * Returns all alerts for a given symbol.
 *
 * The selector returns a stable reference (the store's `alerts` array) so
 * consumers don't re-render on every store read; filtering happens in a memo.
 */
export function useAlertsForSymbol(symbol: string): PriceAlert[] {
  const alerts = usePriceAlertStore((s) => s.alerts);
  return useMemo(
    () => alerts.filter((a) => a.symbol === symbol),
    [alerts, symbol]
  );
}
