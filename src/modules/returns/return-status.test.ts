import { describe, expect, it } from 'vitest';

import {
  RETURN_STATUS_TRANSITIONS,
  canTransitionReturnStatus,
  isReturnResolution,
  isReturnStatus,
} from './return-status';

describe('return status machine', () => {
  it('allows requested → approved → received → refunded|exchanged', () => {
    expect(canTransitionReturnStatus('requested', 'approved')).toBe(true);
    expect(canTransitionReturnStatus('approved', 'received')).toBe(true);
    expect(canTransitionReturnStatus('received', 'refunded')).toBe(true);
    expect(canTransitionReturnStatus('received', 'exchanged')).toBe(true);
  });

  it('blocks skipping and reverse transitions', () => {
    expect(canTransitionReturnStatus('requested', 'received')).toBe(false);
    expect(canTransitionReturnStatus('approved', 'refunded')).toBe(false);
    expect(canTransitionReturnStatus('refunded', 'received')).toBe(false);
    expect(RETURN_STATUS_TRANSITIONS.refunded).toEqual([]);
    expect(RETURN_STATUS_TRANSITIONS.exchanged).toEqual([]);
    expect(RETURN_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });

  it('validates status and resolution helpers', () => {
    expect(isReturnStatus('requested')).toBe(true);
    expect(isReturnStatus('bogus')).toBe(false);
    expect(isReturnResolution('refund')).toBe(true);
    expect(isReturnResolution('credit')).toBe(false);
  });
});
