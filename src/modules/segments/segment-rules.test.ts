import { describe, expect, it } from 'vitest';

import {
  evaluateSegmentRules,
  type SegmentMembershipContext,
} from './segment-rules';

const base: SegmentMembershipContext = {
  customerId: '11111111-1111-4111-8111-111111111111',
};

describe('evaluateSegmentRules', () => {
  it('matches everyone when rules are empty or null', () => {
    expect(evaluateSegmentRules(null, base)).toBe(true);
    expect(evaluateSegmentRules({}, base)).toBe(true);
    expect(evaluateSegmentRules(undefined, base)).toBe(true);
  });

  it('evaluates tag any/all (case-insensitive)', () => {
    const ctx = { ...base, tags: ['VIP', 'newsletter'] };
    expect(
      evaluateSegmentRules({ tags: { any: ['vip', 'gold'] } }, ctx),
    ).toBe(true);
    expect(
      evaluateSegmentRules({ tags: { any: ['gold'] } }, ctx),
    ).toBe(false);
    expect(
      evaluateSegmentRules({ tags: { all: ['vip', 'newsletter'] } }, ctx),
    ).toBe(true);
    expect(
      evaluateSegmentRules({ tags: { all: ['vip', 'gold'] } }, ctx),
    ).toBe(false);
  });

  it('evaluates order count min/max stubs', () => {
    expect(
      evaluateSegmentRules(
        { orderCount: { min: 3 } },
        { ...base, orderCount: 5 },
      ),
    ).toBe(true);
    expect(
      evaluateSegmentRules(
        { orderCount: { min: 3 } },
        { ...base, orderCount: 2 },
      ),
    ).toBe(false);
    expect(
      evaluateSegmentRules(
        { orderCount: { max: 1 } },
        { ...base, orderCount: undefined },
      ),
    ).toBe(true);
  });

  it('evaluates spend minor stubs as bigints', () => {
    expect(
      evaluateSegmentRules(
        { spendMinor: { min: '10000' } },
        { ...base, spendMinor: '25000' },
      ),
    ).toBe(true);
    expect(
      evaluateSegmentRules(
        { spendMinor: { min: '10000', max: '20000' } },
        { ...base, spendMinor: '25000' },
      ),
    ).toBe(false);
    expect(
      evaluateSegmentRules(
        { spendMinor: { min: '1' } },
        { ...base, spendMinor: undefined },
      ),
    ).toBe(false);
  });

  it('combines condition groups with match all/any', () => {
    const ctx = {
      ...base,
      tags: ['vip'],
      orderCount: 1,
      spendMinor: '500',
    };
    expect(
      evaluateSegmentRules(
        {
          match: 'all',
          tags: { any: ['vip'] },
          orderCount: { min: 5 },
        },
        ctx,
      ),
    ).toBe(false);
    expect(
      evaluateSegmentRules(
        {
          match: 'any',
          tags: { any: ['vip'] },
          orderCount: { min: 5 },
        },
        ctx,
      ),
    ).toBe(true);
  });
});
