import { describe, expect, it } from 'vitest';

import {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
  isOrderStatus,
} from './entities/order-status';

describe('OrderStatus (D-03 / D-05)', () => {
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

  it('allows the Phase 1 transition graph', () => {
    expect(canTransitionOrderStatus('pending', 'confirmed')).toBe(true);
    expect(canTransitionOrderStatus('pending', 'cancelled')).toBe(true);
    expect(canTransitionOrderStatus('confirmed', 'fulfilled')).toBe(true);
    expect(canTransitionOrderStatus('confirmed', 'cancelled')).toBe(true);
  });

  it('denies invalid transitions', () => {
    expect(canTransitionOrderStatus('fulfilled', 'pending')).toBe(false);
    expect(canTransitionOrderStatus('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionOrderStatus('pending', 'fulfilled')).toBe(false);
    expect(ORDER_STATUS_TRANSITIONS.fulfilled).toEqual([]);
    expect(ORDER_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});
