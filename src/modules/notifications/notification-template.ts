/**
 * Transactional notification template contract (Phase 2 E-02).
 * Templates render a subject/body from event data; core owns the built-in set,
 * providers (plugins) stay content-agnostic and only deliver.
 */

/** Stable template codes used by listeners and providers. */
export const NotificationTemplateCode = {
  OrderConfirmation: 'order.confirmation',
  PaymentCaptured: 'payment.captured',
  PaymentRefunded: 'payment.refunded',
  PaymentFailed: 'payment.failed',
  ShipmentCreated: 'shipment.created',
} as const;

export type NotificationTemplateCode =
  (typeof NotificationTemplateCode)[keyof typeof NotificationTemplateCode];

export type NotificationTemplateRendered = {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

export type NotificationTemplate = {
  readonly code: string;
  readonly description: string;
  render(data: Record<string, unknown>): NotificationTemplateRendered;
};

/** Formats minor-unit integer amounts (e.g. "1999") as "19.99 USD" for display. */
export function formatMinorAmount(amountMinor: string | number, currencyCode: string): string {
  const amount = BigInt(amountMinor);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const major = abs / 100n;
  const minor = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${major}.${minor} ${currencyCode}`;
}
