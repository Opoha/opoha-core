/**
 * Phase 7 G-02 — Omnichannel gate event contracts on the bus catalog.
 * Channel smokes live in plugin-* / digital-gate; this file locks the
 * PRD exit “events from POS/subscription (and peers) published on event bus”.
 */
import { describe, expect, it } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';

describe('Omnichannel gate smoke (G-02) — event bus contracts', () => {
  it('registers POS / marketplace / digital / subscription channel events', () => {
    expect(CoreEventName.PosSaleCompleted).toBe('PosSaleCompleted');
    expect(CoreEventName.VendorOrderRouted).toBe('VendorOrderRouted');
    expect(CoreEventName.DigitalFulfillmentIssued).toBe('DigitalFulfillmentIssued');
    expect(CoreEventName.SubscriptionRenewed).toBe('SubscriptionRenewed');
  });

  it('keeps channel event names distinct and non-empty', () => {
    const names = [
      CoreEventName.PosSaleCompleted,
      CoreEventName.VendorOrderRouted,
      CoreEventName.DigitalFulfillmentIssued,
      CoreEventName.SubscriptionRenewed,
    ];
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
