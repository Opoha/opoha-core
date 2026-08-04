import { describe, expect, it } from 'vitest';

import { extractSegmentRestriction, membershipContextFromApplyInput } from './segment-eligibility';

describe('segment-eligibility (E-03)', () => {
  it('extractSegmentRestriction returns null when absent or empty', () => {
    expect(extractSegmentRestriction(null)).toBeNull();
    expect(extractSegmentRestriction({})).toBeNull();
    expect(extractSegmentRestriction({ segmentIds: [], segmentCodes: [] })).toBeNull();
    expect(extractSegmentRestriction({ other: true })).toBeNull();
  });

  it('extractSegmentRestriction normalizes ids and codes', () => {
    expect(
      extractSegmentRestriction({
        segmentIds: ['  a  ', '', 1 as unknown as string],
        segmentCodes: ['VIP', ' wholesale '],
      }),
    ).toEqual({
      segmentIds: ['a'],
      segmentCodes: ['vip', 'wholesale'],
    });
  });

  it('membershipContextFromApplyInput requires customerId', () => {
    expect(membershipContextFromApplyInput({})).toBeNull();
    expect(membershipContextFromApplyInput({ customerId: '  ' })).toBeNull();
  });

  it('membershipContextFromApplyInput maps metadata stubs', () => {
    expect(
      membershipContextFromApplyInput({
        customerId: 'cust-1',
        metadata: {
          tags: ['VIP', 'wholesale'],
          orderCount: 3,
          spendMinor: '5000',
        },
      }),
    ).toEqual({
      customerId: 'cust-1',
      tags: ['VIP', 'wholesale'],
      orderCount: 3,
      spendMinor: '5000',
    });
  });
});
