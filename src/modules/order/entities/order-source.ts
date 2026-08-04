/**
 * Channel / order source (Phase 7 A-03).
 * Identifies which sales channel created the order.
 */
export const ORDER_SOURCES = ['web', 'pos', 'marketplace'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

export function isOrderSource(value: string): value is OrderSource {
  return (ORDER_SOURCES as readonly string[]).includes(value);
}

export function assertOrderSource(value: string): OrderSource {
  if (!isOrderSource(value)) {
    throw new Error(`Invalid orderSource "${value}"; expected one of: ${ORDER_SOURCES.join(', ')}`);
  }
  return value;
}
