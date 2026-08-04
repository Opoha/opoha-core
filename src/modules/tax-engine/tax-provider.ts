/**
 * Tax provider port — plugins implement; core never imports tax jurisdiction SDKs.
 *: calculateTax with inclusive / exclusive pricing modes.
 */

/** Minor-unit money amount (bigint as decimal string). */
export type MoneyAmount = {
  amountMinor: string;
  currencyCode: string;
};

/** Whether catalog prices already include tax (inclusive) or exclude it (exclusive). */
export type TaxPricingMode = 'inclusive' | 'exclusive';

/** Jurisdiction address fragment for rate selection. */
export type TaxAddress = {
  countryCode: string;
  postalCode?: string;
  province?: string;
  city?: string;
  line1?: string;
  line2?: string;
};

export type TaxCalculateLineItem = {
  sku?: string;
  productId?: string;
  variantId?: string;
 /** Core tax class code (resolved by provider / entities). */
  taxClassCode?: string;
  quantity: number;
  /** Unit price in minor units (decimal string). */
  unitAmountMinor: string;
};

export type TaxCalculateInput = {
  currencyCode: string;
  pricingMode: TaxPricingMode;
  address?: TaxAddress;
  items: TaxCalculateLineItem[];
  /** Shipping amount in minor units (may be taxable depending on provider). */
  shippingMinor?: string;
  /** Cart/order merchandise subtotal in minor units. */
  subtotalMinor?: string;
  metadata?: Record<string, unknown>;
};

/** Per-line or order-level tax breakdown from a provider. */
export type TaxLineResult = {
  /** Index into {@link TaxCalculateInput.items}; omit for shipping / order-level. */
  lineIndex?: number;
  taxClassCode?: string;
  /** Rate in basis points (1000 = 10.00%). */
  rateBps?: number;
  taxAmountMinor: string;
  taxableAmountMinor: string;
  name?: string;
};

/**
 * Aggregated tax calculation.
 * - exclusive: `taxMinor` is added on top of net prices
 * - inclusive: `taxMinor` is the tax portion embedded in gross prices
 */
export type TaxCalculateResult = {
  currencyCode: string;
  pricingMode: TaxPricingMode;
  taxMinor: string;
  /** Merchandise + shipping net of tax (when provider supplies it). */
  netMinor?: string;
  /** Merchandise + shipping gross including tax (when provider supplies it). */
  grossMinor?: string;
  lines: TaxLineResult[];
  metadata?: Record<string, unknown>;
};

/**
 * Tax provider registered with the tax engine.
 * Plugins must implement calculateTax; class/rule data may live in core or plugin storage.
 */
export type TaxProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  calculateTax(input: TaxCalculateInput): Promise<TaxCalculateResult>;
};

export type RegisteredTaxProvider = {
  pluginId: string;
  provider: TaxProvider;
  active: boolean;
};
