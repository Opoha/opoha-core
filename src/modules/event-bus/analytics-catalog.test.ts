import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_STOREFRONT_MAP,
  isAnalyticsEventName,
} from './analytics-catalog';
import { CoreEventName } from './event-catalog';

describe('analytics catalog', () => {
  it('includes cart/checkout/order lifecycle events', () => {
    expect(ANALYTICS_EVENT_NAMES).toContain(CoreEventName.CartCreated);
    expect(ANALYTICS_EVENT_NAMES).toContain(CoreEventName.CartLineAdded);
    expect(ANALYTICS_EVENT_NAMES).toContain(CoreEventName.CheckoutPrepared);
    expect(ANALYTICS_EVENT_NAMES).toContain(CoreEventName.OrderCreated);
    expect(ANALYTICS_EVENT_NAMES).toContain(CoreEventName.OrderPaid);
  });

  it('maps every analytics event to GA4 + Meta pixel names', () => {
    for (const name of ANALYTICS_EVENT_NAMES) {
      expect(ANALYTICS_STOREFRONT_MAP[name].ga4.length).toBeGreaterThan(0);
      expect(ANALYTICS_STOREFRONT_MAP[name].meta.length).toBeGreaterThan(0);
    }
  });

  it('isAnalyticsEventName narrows catalog members', () => {
    expect(isAnalyticsEventName(CoreEventName.CartLineAdded)).toBe(true);
    expect(isAnalyticsEventName(CoreEventName.ProductCreated)).toBe(false);
  });
});
