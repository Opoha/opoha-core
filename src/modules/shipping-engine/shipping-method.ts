/**
 * Shipping method port — plugins implement; core never imports carrier SDKs.
 * Phase 2: quoteRates + optional label hooks (create/void).
 */

/** Minor-unit money amount (bigint as decimal string). */
export type MoneyAmount = {
  amountMinor: string;
  currencyCode: string;
};

/** Destination / origin address fragment for rate quotes and labels. */
export type ShippingAddress = {
  countryCode: string;
  postalCode?: string;
  province?: string;
  city?: string;
  line1?: string;
  line2?: string;
};

export type ShippingQuoteLineItem = {
  sku?: string;
  productId?: string;
  variantId?: string;
  quantity: number;
  /** Unit price in minor units (decimal string). */
  unitAmountMinor: string;
  weightGrams?: number;
};

export type ShippingQuoteInput = {
  currencyCode: string;
  destination: ShippingAddress;
  origin?: ShippingAddress;
  items: ShippingQuoteLineItem[];
  /** Cart/order subtotal in minor units (decimal string). */
  subtotalMinor?: string;
  metadata?: Record<string, unknown>;
};

/** One rate option returned by a shipping method provider. */
export type ShippingRateQuote = {
  /** Provider-specific rate / service-level code. */
  code: string;
  displayName: string;
  amount: MoneyAmount;
  minTransitDays?: number;
  maxTransitDays?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Rate quote tagged with the registered shipping method (engine orchestration).
 * `methodCode` is the ShippingMethodProvider.code; `code` is the rate/service code.
 */
export type QuotedShippingRate = ShippingRateQuote & {
  methodCode: string;
  methodDisplayName: string;
};

/** Aggregated result of ShippingEngine.quote across active methods. */
export type ShippingQuoteResult = {
  currencyCode: string;
  rates: QuotedShippingRate[];
};

export type ShippingLabelInput = {
  orderId: string;
  shipmentId?: string;
  /** Rate code previously returned by quoteRates. */
  rateCode: string;
  destination: ShippingAddress;
  origin?: ShippingAddress;
  items: ShippingQuoteLineItem[];
  amount: MoneyAmount;
  metadata?: Record<string, unknown>;
};

export type ShippingLabelResult = {
  status: 'created' | 'pending' | 'failed';
  labelUrl?: string;
  trackingNumber?: string;
  externalId?: string;
  raw?: unknown;
  errorMessage?: string;
};

export type ShippingVoidLabelInput = {
  orderId: string;
  externalId?: string;
  trackingNumber?: string;
  metadata?: Record<string, unknown>;
};

export type ShippingVoidLabelResult = {
  status: 'voided' | 'pending' | 'failed';
  raw?: unknown;
  errorMessage?: string;
};

/**
 * Shipping method registered with the shipping engine.
 * Plugins must implement quoteRates; label hooks are optional (carrier plugins).
 */
export type ShippingMethodProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  quoteRates(input: ShippingQuoteInput): Promise<ShippingRateQuote[]>;
  createLabel?(input: ShippingLabelInput): Promise<ShippingLabelResult>;
  voidLabel?(input: ShippingVoidLabelInput): Promise<ShippingVoidLabelResult>;
};

export type RegisteredShippingMethod = {
  pluginId: string;
  method: ShippingMethodProvider;
  active: boolean;
};
