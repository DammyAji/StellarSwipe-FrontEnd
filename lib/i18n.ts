/**
 * Simple i18n system with JSON-based locale files
 */
import * as Sentry from "@sentry/nextjs";
// Bundled statically (not fetched) so English strings — the fallback for
// every other locale — are available synchronously from the very first
// render, in SSR, and in tests, with no dependency on initI18n() having run.
import enTranslations from "@/public/locales/en.json";

export type Locale = "en" | "ng" | "es" | "fr" | "de" | "zh" | "ar";

const LOCALE_KEY = "stellarswipe:locale";
const DEFAULT_LOCALE: Locale = "en";
const SUPPORTED_LOCALES: Locale[] = ["en", "ng", "es", "fr", "de", "zh", "ar"];

/** RTL locales — consumers should apply dir="rtl" when active */
export const RTL_LOCALES: Locale[] = ["ar"];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** BCP-47 tags for Intl APIs */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-US",
  ng: "yo-NG",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
  ar: "ar-SA",
};

/** Format a number according to the current locale */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(LOCALE_BCP47[currentLocale], options).format(
    value
  );
}

/** Format a date according to the current locale */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(LOCALE_BCP47[currentLocale], options).format(
    new Date(date)
  );
}

/** Format currency according to the current locale */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(LOCALE_BCP47[currentLocale], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

let currentLocale: Locale = DEFAULT_LOCALE;
// Seeded synchronously (not `{}`) so `t()` returns real strings before
// initI18n() has ever run — first paint, SSR, and tests included.
let translations: Record<string, any> = enTranslations;
let fallbackTranslations: Record<string, any> = enTranslations;

/** CLDR plural forms a locale entry may provide for a countable message. */
export type PluralForms = Partial<
  Record<"zero" | "one" | "two" | "few" | "many" | "other", string>
>;

export type TranslationParams = Record<string, string | number>;

/**
 * Get nested value from object using dot notation
 * e.g., "signals.buy_signal" -> translations.signals.buy_signal
 *
 * A leaf may be a plain string, or a PluralForms object for messages that
 * vary by count (selected via Intl.PluralRules in `t()`).
 */
function getNestedValue(
  obj: any,
  path: string
): string | PluralForms | undefined {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current?.[key] === undefined) return undefined;
    current = current[key];
  }
  if (typeof current === "string") return current;
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as PluralForms;
  }
  return undefined;
}

/** Pick the right plural form for `count` in the active locale, with a safe fallback. */
function selectPluralForm(forms: PluralForms, count: number): string {
  let category: Intl.LDMLPluralRule = "other";
  try {
    category = new Intl.PluralRules(LOCALE_BCP47[currentLocale]).select(
      count
    );
  } catch {
    // Unsupported locale for PluralRules — fall through to "other".
  }
  return (
    forms[category] ??
    forms.other ??
    Object.values(forms).find((v): v is string => typeof v === "string") ??
    ""
  );
}

/** Replace `{{token}}` placeholders in a template with values from `params`. */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) =>
    token in params ? String(params[token]) : match
  );
}

/** Turn a missing key's last segment into a presentable fallback, e.g. "unread_count" -> "Unread count". */
function humanizeKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  const words = last.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Load locale JSON file
 */
async function loadLocale(locale: Locale): Promise<Record<string, any>> {
  try {
    const response = await fetch(`/locales/${locale}.json`);
    if (!response.ok) throw new Error(`Failed to load ${locale} locale`);
    return await response.json();
  } catch (err) {
    Sentry.captureException(err);
    return {};
  }
}

/**
 * Initialize i18n system
 */
export async function initI18n() {
  if (typeof window === "undefined") return;

  // Load stored locale or use default
  const stored = localStorage.getItem(LOCALE_KEY);
  currentLocale =
    stored && SUPPORTED_LOCALES.includes(stored as Locale)
      ? (stored as Locale)
      : DEFAULT_LOCALE;

  // English fallback is statically bundled (see `enTranslations` import) —
  // no fetch needed, and it's never overwritten with a possibly-failed one.
  fallbackTranslations = enTranslations;

  // Load current locale if not English
  translations =
    currentLocale !== DEFAULT_LOCALE
      ? await loadLocale(currentLocale)
      : fallbackTranslations;
}

/**
 * Set current locale
 */
export async function setLocale(locale: Locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn(`Unsupported locale: ${locale}`);
    }
    return;
  }

  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCALE_KEY, locale);
  }

  // Load translations
  if (locale === DEFAULT_LOCALE) {
    translations = fallbackTranslations;
  } else {
    translations = await loadLocale(locale);
  }
}

/**
 * Translate a key with fallback to English.
 * In development, logs a clear warning with the active locale when a key is missing.
 *
 * `params` are used both for `{{token}}` interpolation and, when `params.count`
 * is set, to select a CLDR plural form if the resolved entry defines one —
 * e.g. `t("list.items_selected", { count: items.length })` against
 * `{ "one": "{{count}} item selected", "other": "{{count}} items selected" }`.
 */
export function t(key: string, params?: TranslationParams): string {
  // Try current locale first
  let value = getNestedValue(translations, key);
  let usedFallback = false;

  if (value === undefined) {
    // Fall back to English
    value = getNestedValue(fallbackTranslations, key);
    usedFallback = value !== undefined;
  }

  if (value === undefined) {
    // Key missing from all locales — deliberate, presentable fallback.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn(
        `[i18n] Missing translation key "${key}" in locale "${currentLocale}" (no fallback found).`
      );
    }
    return humanizeKey(key);
  }

  if (usedFallback && process.env.NODE_ENV === "development" && currentLocale !== DEFAULT_LOCALE) {
    // eslint-disable-next-line no-console
    console.warn(
      `[i18n] Missing translation key "${key}" for locale "${currentLocale}". Falling back to "${DEFAULT_LOCALE}".`
    );
  }

  const template =
    typeof value === "string"
      ? value
      : selectPluralForm(value, Number(params?.count ?? 0));

  return interpolate(template, params);
}

/**
 * Get current locale
 */
export function getCurrentLocale(): Locale {
  return currentLocale;
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): Locale[] {
  return SUPPORTED_LOCALES;
}

/**
 * Translation keys for the evidence, provider signal scope, covered-assets,
 * and custom snooze-time UI. Kept here as a typed reference so components and
 * tests share one source of truth; the actual English copy lives in
 * public/locales/en.json and is resolved through `t()` (which falls back to
 * English for every other locale).
 */
export const NEW_UI_TRANSLATION_KEYS = {
  evidence: {
    heading: "evidence.heading",
    empty: "evidence.empty",
    error: "evidence.error",
    loading: "evidence.loading",
    linkLabel: "evidence.link_label",
  },
  providerSignalScope: {
    label: "provider.signals.scope.label",
    active: "provider.signals.scope.active",
    archived: "provider.signals.scope.archived",
    all: "provider.signals.scope.all",
    emptyActive: "provider.signals.scope.empty_active",
    emptyArchived: "provider.signals.scope.empty_archived",
    emptyAll: "provider.signals.scope.empty_all",
    error: "provider.signals.scope.error",
    loading: "provider.signals.scope.loading",
  },
  coveredAssets: {
    heading: "provider.assets.heading",
    empty: "provider.assets.empty",
    error: "provider.assets.error",
    loading: "provider.assets.loading",
  },
  snoozeCustomTime: {
    label: "snooze.custom_time.label",
    set: "snooze.custom_time.set",
    edit: "snooze.custom_time.edit",
    clear: "snooze.custom_time.clear",
    invalidFormat: "snooze.custom_time.invalid_format",
    mustBeFuture: "snooze.custom_time.must_be_future",
    error: "snooze.custom_time.error",
  },
} as const;
