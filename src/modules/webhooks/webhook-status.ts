export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'succeeded', 'failed', 'dead_letter'] as const;

export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export function isWebhookDeliveryStatus(value: string): value is WebhookDeliveryStatus {
  return (WEBHOOK_DELIVERY_STATUSES as readonly string[]).includes(value);
}

/** Default max attempts before dead-letter (Phase 8 D-02). */
export const DEFAULT_WEBHOOK_MAX_ATTEMPTS = 5;

/**
 * Exponential-ish backoff delays (ms) indexed by attempt number (1-based).
 * attempt 1 → immediate; subsequent retries use later slots.
 */
export const DEFAULT_WEBHOOK_BACKOFF_MS = [0, 1_000, 5_000, 30_000, 120_000] as const;

export function webhookBackoffMs(
  attempt: number,
  schedule: readonly number[] = DEFAULT_WEBHOOK_BACKOFF_MS,
): number {
  if (attempt <= 1) {
    return schedule[0] ?? 0;
  }
  const idx = Math.min(attempt - 1, schedule.length - 1);
  return schedule[idx] ?? schedule[schedule.length - 1] ?? 0;
}
