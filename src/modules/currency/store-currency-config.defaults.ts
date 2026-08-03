/** Fallback when a store has no currency pointer yet. */
export const DEFAULT_STORE_CURRENCY = 'USD' as const;

/**
 * Defaults applied when a store has no currency config row yet.
 * Prefer the store's `defaultCurrencyCode` when available.
 */
export function defaultStoreCurrencyConfig(currencyCode: string = DEFAULT_STORE_CURRENCY) {
  const code = currencyCode.trim().toUpperCase() || DEFAULT_STORE_CURRENCY;
  return {
    settlementCurrencyCode: code,
    displayCurrencyCode: code,
    enabledDisplayCurrencies: [code] as string[],
  };
}
