/**
 * Product / SKU fulfillment mode.
 * Variant mode is authoritative at purchase; product mode is the default for new variants.
 */
export const FULFILLMENT_MODES = ['physical', 'digital', 'service'] as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export function isFulfillmentMode(value: string): value is FulfillmentMode {
  return (FULFILLMENT_MODES as readonly string[]).includes(value);
}

export function assertFulfillmentMode(value: string): FulfillmentMode {
  if (!isFulfillmentMode(value)) {
    throw new Error(
      `Invalid fulfillmentMode "${value}"; expected one of: ${FULFILLMENT_MODES.join(', ')}`,
    );
  }
  return value;
}
