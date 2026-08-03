/**
 * FX rate provider port — plugins implement; core never imports FX provider SDKs.
 * Phase 5 D-04: optional live rate source. Manual rates via ExchangeRateService
 * (D-02) remain exit-critical; a registered provider only supplies rates when
 * explicitly synced via ExchangeRateService.syncFromProvider.
 */

/** Currency pair for an FX rate lookup. */
export type FXRateQuoteInput = {
  /** ISO 4217 source currency. */
  fromCurrencyCode: string;
  /** ISO 4217 target currency. */
  toCurrencyCode: string;
};

/** Quoted rate: `1 fromCurrencyCode = rate × toCurrencyCode`. */
export type FXRateQuoteResult = {
  rate: number;
  /** Provider-reported quote timestamp (ISO 8601), when available. */
  asOf?: string;
  metadata?: Record<string, unknown>;
};

/**
 * FX rate provider registered with the currency module.
 * Plugins (e.g. openexchangerates, ECB) must implement getRate.
 */
export type FXRateProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  getRate(input: FXRateQuoteInput): Promise<FXRateQuoteResult>;
};

export type RegisteredFXRateProvider = {
  pluginId: string;
  provider: FXRateProvider;
  active: boolean;
};
