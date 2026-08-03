import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES, isOrderStatus } from './entities/order-status';

describe('OrderStatus (D-03)', () => {
  it('exposes the Phase 1 status enum', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'confirmed',
      'fulfilled',
      'cancelled',
    ]);
  });

  it('type-guards known statuses', () => {
    expect(isOrderStatus('pending')).toBe(true);
    expect(isOrderStatus('shipped')).toBe(false);
  });
});
