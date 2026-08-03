/**
 * Promotion rule provider port — plugins implement; core orchestrates apply.
 * Phase 2 D-01: coupons / automatic discounts extend this surface (D-02+ entities).
 */

/** Line item fragment for promotion evaluation. */
export type PromotionApplyLineItem = {
  sku?: string;
  productId?: string;
  variantId?: string;
  quantity: number;
  /** Unit price in minor units (decimal string). */
  unitAmountMinor: string;
};

/** Cart/checkout context passed to rule providers. */
export type PromotionApplyInput = {
  currencyCode: string;
  items: PromotionApplyLineItem[];
  /** Merchandise subtotal in minor units. */
  subtotalMinor?: string;
  /** Selected shipping amount in minor units. */
  shippingMinor?: string;
  /** Optional coupon code entered on the cart. */
  couponCode?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
};

/** Kind of promotion application (plugins may use custom strings). */
export type PromotionApplicationKind =
  | 'coupon'
  | 'automatic'
  | 'bxgy'
  | 'free_shipping'
  | string;

/** One applied promotion / discount line from a provider. */
export type PromotionApplication = {
  /** Rule or coupon code. */
  code: string;
  kind: PromotionApplicationKind;
  /** Discount amount in minor units contributed by this application. */
  discountMinor: string;
  /** When true, checkout should zero shipping. */
  freeShipping?: boolean;
  label?: string;
  /** Index into {@link PromotionApplyInput.items}; omit for order-level. */
  lineIndex?: number;
  metadata?: Record<string, unknown>;
};

/** Aggregated promotion result from one provider (or the engine). */
export type PromotionApplyResult = {
  currencyCode: string;
  /** Total discount in minor units (sum of applications, pre-cap). */
  discountMinor: string;
  applications: PromotionApplication[];
  freeShipping?: boolean;
  metadata?: Record<string, unknown>;
};

/**
 * Promotion rule provider registered with the promotions engine.
 * Plugins (coupon, discount) implement `apply`; core never imports rule SDKs.
 */
export type PromotionRuleProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  apply(input: PromotionApplyInput): Promise<PromotionApplyResult>;
};

export type RegisteredPromotionRuleProvider = {
  pluginId: string;
  provider: PromotionRuleProvider;
  active: boolean;
};
