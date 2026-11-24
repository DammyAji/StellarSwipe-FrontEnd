/**
 * Tracked settings for the change history (#900).
 *
 * Each entry binds a persisted preference store to a SettingDefinition so
 * changes are recorded no matter which surface made them, and restores go
 * through the store's own setter (so side effects like the high-contrast
 * class still apply).
 */

import { useThemeStore } from "@/store/useThemeStore";
import { useContrastStore } from "@/store/useContrastStore";
import {
  CURRENCY_LABELS,
  useCurrencyStore,
  type DisplayCurrency,
} from "@/store/useCurrencyStore";
import { useFeedDensityStore, type FeedDensity } from "@/store/useFeedDensityStore";
import {
  TRADE_ENTRY_MODE_LABELS,
  useTradeEntryModeStore,
  type TradeEntryMode,
} from "@/store/useTradeEntryModeStore";
import { useDataSaverStore } from "@/store/useDataSaverStore";
import {
  SENSITIVITY_MULTIPLIERS,
  useSwipeSettingsStore,
  type SensitivityLevel,
} from "@/store/useSwipeSettingsStore";
import { usePrivacyStore } from "@/store/usePrivacyStore";
import { useWebhookStore } from "@/store/useWebhookStore";
import { useSettingsHistoryStore } from "@/store/useSettingsHistoryStore";
import {
  createHistoryEntry,
  formatHistoryValue,
  getRestoreAvailability,
  type SettingDefinition,
  type SettingValue,
} from "@/lib/settingsHistory";

interface ObservableStore<S> {
  getState: () => S;
  subscribe: (listener: (state: S, prev: S) => void) => () => void;
  persist?: { hasHydrated: () => boolean };
}

function storeSetting<S, T extends SettingValue>(
  store: ObservableStore<S>,
  select: (state: S) => T,
  def: Omit<SettingDefinition<T>, "read" | "subscribe"> & {
    /** Skip changes that aren't user preference changes. */
    ignore?: (state: S) => boolean;
  }
): SettingDefinition<T> {
  const { ignore, ...rest } = def;
  return {
    ...rest,
    read: () => select(store.getState()),
    subscribe: (onChange) =>
      store.subscribe((state, prev) => {
        // Rehydrating from storage restores old values; it isn't a change.
        if (store.persist && !store.persist.hasHydrated()) return;
        if (ignore?.(state)) return;
        const next = select(state);
        const before = select(prev);
        if (!Object.is(next, before)) onChange(next, before);
      }),
  };
}

const onOff = (v: boolean) => (v ? "On" : "Off");
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  storeSetting(useThemeStore, (s) => s.theme, {
    id: "theme",
    label: "Theme",
    format: (v) => (v === "dark" ? "Dark" : "Light"),
    restore: (v) => useThemeStore.getState().setTheme(v),
    isValid: (v): v is "dark" | "light" => v === "dark" || v === "light",
    // Following the OS theme isn't a preference change.
    ignore: (s) => !s.hasExplicitChoice,
  }),
  storeSetting(useThemeStore, (s) => s.accentColor, {
    id: "accentColor",
    label: "Accent color",
    format: (v) => v.toUpperCase(),
    restore: (v) => useThemeStore.getState().setAccentColor(v),
    isValid: (v): v is string =>
      typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v),
  }),
  storeSetting(useThemeStore, (s) => s.chartPalette, {
    id: "chartPalette",
    label: "Chart palette",
    format: (v) => (v === "colorblind" ? "Color-blind-safe" : "Default"),
    restore: (v) => useThemeStore.getState().setChartPalette(v),
    isValid: (v): v is "default" | "colorblind" =>
      v === "default" || v === "colorblind",
  }),
  storeSetting(useContrastStore, (s) => s.highContrast, {
    id: "highContrast",
    label: "High contrast",
    format: onOff,
    restore: (v) => useContrastStore.getState().setHighContrast(v),
    isValid: isBoolean,
  }),
  storeSetting(useCurrencyStore, (s) => s.currency, {
    id: "currency",
    label: "Display currency",
    format: (v) => `${v} (${CURRENCY_LABELS[v] ?? v})`,
    restore: (v) => useCurrencyStore.getState().setCurrency(v),
    isValid: (v): v is DisplayCurrency =>
      typeof v === "string" && v in CURRENCY_LABELS,
  }),
  storeSetting(useFeedDensityStore, (s) => s.density, {
    id: "feedDensity",
    label: "Signal feed density",
    format: (v) => (v === "compact" ? "Compact" : "Comfortable"),
    restore: (v) => useFeedDensityStore.getState().setDensity(v),
    isValid: (v): v is FeedDensity => v === "compact" || v === "comfortable",
  }),
  storeSetting(useTradeEntryModeStore, (s) => s.entryMode, {
    id: "tradeEntryMode",
    label: "Default trade amount entry",
    format: (v) => TRADE_ENTRY_MODE_LABELS[v] ?? v,
    restore: (v) => useTradeEntryModeStore.getState().setEntryMode(v),
    isValid: (v): v is TradeEntryMode =>
      typeof v === "string" && v in TRADE_ENTRY_MODE_LABELS,
  }),
  storeSetting(useDataSaverStore, (s) => s.dataSaverEnabled, {
    id: "dataSaver",
    label: "Data saver",
    format: onOff,
    restore: (v) => useDataSaverStore.getState().setDataSaverEnabled(v),
    isValid: isBoolean,
  }),
  storeSetting(useSwipeSettingsStore, (s) => s.sensitivity, {
    id: "swipeSensitivity",
    label: "Swipe sensitivity",
    format: (v) => v.charAt(0).toUpperCase() + v.slice(1),
    restore: (v) => useSwipeSettingsStore.getState().setSensitivity(v),
    isValid: (v): v is SensitivityLevel =>
      typeof v === "string" && v in SENSITIVITY_MULTIPLIERS,
  }),
  storeSetting(useSwipeSettingsStore, (s) => s.swapDirections, {
    id: "swapDirections",
    label: "Swap swipe directions",
    format: onOff,
    restore: (v) => useSwipeSettingsStore.getState().setSwapDirections(v),
    isValid: isBoolean,
  }),
  storeSetting(usePrivacyStore, (s) => s.privacyMode, {
    id: "privacyMode",
    label: "Privacy mode",
    format: onOff,
    restore: (v) => usePrivacyStore.getState().setPrivacyMode(v),
    isValid: isBoolean,
  }),
  // Endpoint URLs can embed tokens — always redacted, never restorable.
  storeSetting(
    useWebhookStore,
    (s) =>
      s.webhooks
        .map((w) => w.url)
        .sort()
        .join(", "),
    {
      id: "webhookEndpoints",
      label: "Webhook endpoints",
      sensitive: true,
    }
  ),
];

export function getSettingDefinition(
  id: string
): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find((d) => d.id === id);
}

// ── Tracking ────────────────────────────────────────────────────────────────

let trackingRefs = 0;
let unsubscribers: Array<() => void> = [];
/** Set while a restore is applying, so its change is linked to the source entry. */
let pendingRestore: { settingId: string; entryId: string } | null = null;

/**
 * Starts recording changes for every registered setting. Reference-counted,
 * so the app shell and the history view can both call it safely. Returns a
 * stop function.
 */
export function startSettingsHistoryTracking(): () => void {
  trackingRefs += 1;
  if (trackingRefs === 1) {
    unsubscribers = SETTINGS_REGISTRY.map((def) =>
      def.subscribe((next, prev) => {
        const restoredFromId =
          pendingRestore?.settingId === def.id
            ? pendingRestore.entryId
            : undefined;
        useSettingsHistoryStore
          .getState()
          .record(createHistoryEntry(def, prev, next, new Date(), restoredFromId));
      })
    );
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    trackingRefs -= 1;
    if (trackingRefs === 0) {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
    }
  };
}

// ── Restore ─────────────────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true; label: string; value: string }
  | { ok: false; message: string };

/** Restores the prior value recorded in a history entry. */
export function restoreSettingFromHistory(entryId: string): RestoreResult {
  const entry = useSettingsHistoryStore
    .getState()
    .entries.find((e) => e.id === entryId);
  if (!entry) {
    return { ok: false, message: "That change is no longer in history." };
  }

  const def = getSettingDefinition(entry.settingId);
  const availability = getRestoreAvailability(def, entry);
  if (!availability.restorable) {
    return { ok: false, message: availability.message };
  }
  if (!def?.restore || entry.previous === null) {
    return { ok: false, message: "Restore isn't supported for this setting." };
  }

  pendingRestore = { settingId: def.id, entryId: entry.id };
  try {
    def.restore(entry.previous);
  } catch {
    return {
      ok: false,
      message: `Couldn't restore ${entry.label}. Please try again.`,
    };
  } finally {
    pendingRestore = null;
  }

  return {
    ok: true,
    label: entry.label,
    value: formatHistoryValue(def, entry.previous, false),
  };
}
