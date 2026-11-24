import { useCallback, useMemo } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  formatCurrency as baseCurrency,
  formatPercent as basePercent,
  formatNumber as baseNumber,
  formatCompactNumber,
  formatCount,
  formatWithUnit,
  formatDateTime as baseDateTime,
  parseLocalDateTimeInput,
  type FormatterOptions,
} from "@/lib/localeFormatter";

/**
 * React hook for locale-aware data formatting.
 * Updates formatters when locale changes.
 *
 * @example
 * export function MyComponent() {
 *   const { formatCurrency, formatPercent } = useLocaleFormatter();
 *   return (
 *     <>
 *       <span>{formatCurrency(1234.56, 'USD')}</span>
 *       <span>{formatPercent(0.421, 2)}</span>
 *     </>
 *   );
 * }
 */
export function useLocaleFormatter() {
  const { locale, isInitialized } = useI18n();

  // Memoize formatter functions so they update when locale changes
  const formatCurrency = useCallback(
    (value: number, currency: string = "USD") => {
      return baseCurrency(value, currency, locale);
    },
    [locale]
  );

  const formatPercent = useCallback(
    (value: number, decimals: number = 2) => {
      return basePercent(value, decimals, locale);
    },
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options?: FormatterOptions) => {
      return baseNumber(value, options);
    },
    []
  );

  const compact = useCallback(
    (value: number) => {
      return formatCompactNumber(value, locale);
    },
    [locale]
  );

  const count = useCallback(
    (value: number) => {
      return formatCount(value, locale);
    },
    [locale]
  );

  const withUnit = useCallback(
    (value: number, unit: string, options?: FormatterOptions) => {
      return formatWithUnit(value, unit, options);
    },
    []
  );

  const formatDateTime = useCallback(
    (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
      return baseDateTime(value, locale, options);
    },
    [locale]
  );

  // Return memoized formatter object
  return useMemo(
    () => ({
      formatCurrency,
      formatPercent,
      formatNumber,
      formatCompact: compact,
      formatCount: count,
      formatWithUnit: withUnit,
      formatDateTime,
      parseLocalDateTimeInput,
      isInitialized,
    }),
    [
      formatCurrency,
      formatPercent,
      formatNumber,
      compact,
      count,
      withUnit,
      formatDateTime,
      isInitialized,
    ]
  );
}
