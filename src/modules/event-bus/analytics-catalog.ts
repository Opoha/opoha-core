import { CoreEventName } from './event-catalog';

/**
 * Analytics-oriented subset of core domain events (Phase 4 F-01).
 * Past-tense domain facts only — no provider SDKs in core.
 * Storefront/plugin sinks map these to GA4 / Meta Pixel (see workspace design docs).
 */
export const ANALYTICS_EVENT_NAMES = [
  CoreEventName.CartCreated,
  CoreEventName.CartLineAdded,
  CoreEventName.CartLineUpdated,
  CoreEventName.CartLineRemoved,
  CoreEventName.CheckoutPrepared,
  CoreEventName.OrderCreated,
  CoreEventName.OrderPaid,
  CoreEventName.OrderCancelled,
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/** Suggested storefront pixel names — core never calls GA/Meta SDKs. */
export type AnalyticsStorefrontMapping = {
  ga4: string;
  meta: string;
};

export const ANALYTICS_STOREFRONT_MAP: Record<
  AnalyticsEventName,
  AnalyticsStorefrontMapping
> = {
  [CoreEventName.CartCreated]: {
    ga4: 'cart_created',
    meta: 'CustomCartCreated',
  },
  [CoreEventName.CartLineAdded]: { ga4: 'add_to_cart', meta: 'AddToCart' },
  [CoreEventName.CartLineUpdated]: {
    ga4: 'add_to_cart',
    meta: 'AddToCart',
  },
  [CoreEventName.CartLineRemoved]: {
    ga4: 'remove_from_cart',
    meta: 'CustomRemoveFromCart',
  },
  [CoreEventName.CheckoutPrepared]: {
    ga4: 'begin_checkout',
    meta: 'InitiateCheckout',
  },
  /** Prefer OrderPaid for purchase pixels when payment capture is authoritative. */
  [CoreEventName.OrderCreated]: {
    ga4: 'purchase',
    meta: 'Purchase',
  },
  [CoreEventName.OrderPaid]: { ga4: 'purchase', meta: 'Purchase' },
  [CoreEventName.OrderCancelled]: {
    ga4: 'refund',
    meta: 'CustomOrderCancelled',
  },
};

export function isAnalyticsEventName(
  eventName: string,
): eventName is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(eventName);
}
