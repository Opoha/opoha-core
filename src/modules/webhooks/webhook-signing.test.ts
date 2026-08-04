import { describe, expect, it } from 'vitest';

import { signWebhookPayload, verifyWebhookSignature } from './webhook-signing';

describe('webhook-signing (D-02)', () => {
  it('signs payload deterministically and verifies', () => {
    const body = JSON.stringify({ eventName: 'OrderPaid', data: { id: '1' } });
    const sig = signWebhookPayload('test-secret-key', body);
    expect(sig.startsWith('sha256=')).toBe(true);
    expect(verifyWebhookSignature('test-secret-key', body, sig)).toBe(true);
    expect(verifyWebhookSignature('wrong-secret!!', body, sig)).toBe(false);
  });

  it('rejects truncated signatures without throwing', () => {
    const body = '{}';
    const sig = signWebhookPayload('abcdefgh', body);
    expect(verifyWebhookSignature('abcdefgh', body, sig.slice(0, 10))).toBe(false);
  });
});
