export const SUBSCRIPTION_STATUSES = [
  'active',
  'paused',
  'canceled',
  'past_due',
  'expired',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export const BILLING_INTERVAL_UNITS = ['day', 'week', 'month', 'year'] as const;

export type BillingIntervalUnit = (typeof BILLING_INTERVAL_UNITS)[number];

export function isBillingIntervalUnit(value: string): value is BillingIntervalUnit {
  return (BILLING_INTERVAL_UNITS as readonly string[]).includes(value);
}

/**
 * Advance `from` by `count` billing intervals of `unit` (schedule math for
 * plan subscribe / renewal — /). UTC calendar arithmetic via
 * `Date` setters; DST-agnostic by design (no wall-clock zone applied).
 */
export function addBillingInterval(from: Date, unit: BillingIntervalUnit, count: number): Date {
  const next = new Date(from.getTime());
  switch (unit) {
    case 'day':
      next.setUTCDate(next.getUTCDate() + count);
      break;
    case 'week':
      next.setUTCDate(next.getUTCDate() + count * 7);
      break;
    case 'month':
      next.setUTCMonth(next.getUTCMonth() + count);
      break;
    case 'year':
      next.setUTCFullYear(next.getUTCFullYear() + count);
      break;
  }
  return next;
}
