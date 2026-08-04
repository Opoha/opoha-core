/**
 * Order lifecycle statuses.
 * Transitions enforced in /.
 */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'fulfilled',
  'cancelled',
  /** B2B: placed, awaiting company approval. */
  'draft',
  /** B2B: approved, awaiting payment confirm. */
  'approved',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Allowed status transitions.
 * Terminal: fulfilled, cancelled.
 * B2B path: draft → approved → confirmed.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ['approved', 'cancelled'],
  approved: ['confirmed', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
