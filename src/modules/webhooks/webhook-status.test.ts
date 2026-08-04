import { describe, expect, it } from 'vitest';

import { isWebhookDeliveryStatus, webhookBackoffMs } from './webhook-status';

describe('webhook-status', () => {
  it('recognizes delivery statuses', () => {
    expect(isWebhookDeliveryStatus('pending')).toBe(true);
    expect(isWebhookDeliveryStatus('dead_letter')).toBe(true);
    expect(isWebhookDeliveryStatus('bogus')).toBe(false);
  });

  it('returns backoff by attempt index', () => {
    const schedule = [0, 100, 500] as const;
    expect(webhookBackoffMs(1, schedule)).toBe(0);
    expect(webhookBackoffMs(2, schedule)).toBe(100);
    expect(webhookBackoffMs(3, schedule)).toBe(500);
    expect(webhookBackoffMs(9, schedule)).toBe(500);
  });
});
