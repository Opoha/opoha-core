import { createHmac, timingSafeEqual } from 'node:crypto';

/** Header name for HMAC-SHA256 signature (`sha256=<hex>`). */
export const WEBHOOK_SIGNATURE_HEADER = 'X-Opoha-Signature';

export const WEBHOOK_EVENT_HEADER = 'X-Opoha-Event';

export const WEBHOOK_DELIVERY_HEADER = 'X-Opoha-Delivery';

/**
 * Sign a raw JSON body with HMAC-SHA256.
 * Returns the header value `sha256=<hex>`.
 */
export function signWebhookPayload(secret: string, body: string): string {
  const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${digest}`;
}

/** Constant-time verification of a signature header against body + secret. */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  signatureHeader: string,
): boolean {
  const expected = signWebhookPayload(secret, body);
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader.trim());
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
