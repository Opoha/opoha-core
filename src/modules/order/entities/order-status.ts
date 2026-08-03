/** Order lifecycle statuses (Phase 1 D-03). Transitions enforced in D-05. */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'fulfilled',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
