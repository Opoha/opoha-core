import { describe, expect, it } from 'vitest';

import {
  computeRuleDiscount,
  isWithinSchedule,
  meetsMinSubtotal,
  mergePromotionApplications,
  selectAutomaticRules,
  type DiscountableRule,
} from './apply-discount';
import type { DiscountRuleEntity } from './entities/discount-rule.entity';

function rule(
  overrides: Partial<DiscountableRule> & Pick<DiscountableRule, 'code' | 'kind'>,
): DiscountableRule {
  return {
    name: overrides.code,
    valueBps: null,
    amountMinor: null,
    currencyCode: null,
    minSubtotalMinor: null,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('apply-discount helpers (D-03)', () => {
  it('isWithinSchedule respects active flag and window', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    expect(isWithinSchedule({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
    expect(
      isWithinSchedule(
        {
          isActive: true,
          startsAt: new Date('2026-08-04T00:00:00Z'),
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isWithinSchedule(
        {
          isActive: false,
          startsAt: null,
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it('meetsMinSubtotal', () => {
    expect(meetsMinSubtotal({ minSubtotalMinor: null }, 100n)).toBe(true);
    expect(meetsMinSubtotal({ minSubtotalMinor: '500' }, 499n)).toBe(false);
    expect(meetsMinSubtotal({ minSubtotalMinor: '500' }, 500n)).toBe(true);
  });

  it('computes percentage coupon discount in basis points', () => {
    const result = computeRuleDiscount(
      rule({ code: 'SAVE10', kind: 'percentage', valueBps: 1000 }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'coupon',
    );
    expect(result.discountMinor).toBe(200n);
    expect(result.application?.code).toBe('SAVE10');
    expect(result.application?.kind).toBe('coupon');
  });

  it('computes fixed_amount and caps at subtotal', () => {
    const result = computeRuleDiscount(
      rule({
        code: 'FIVE',
        kind: 'fixed_amount',
        amountMinor: '5000',
        currencyCode: 'USD',
      }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'coupon',
    );
    expect(result.discountMinor).toBe(2000n);
  });

  it('rejects fixed_amount currency mismatch', () => {
    const result = computeRuleDiscount(
      rule({
        code: 'EUR5',
        kind: 'fixed_amount',
        amountMinor: '500',
        currencyCode: 'EUR',
      }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'coupon',
    );
    expect(result.discountMinor).toBe(0n);
    expect(result.application).toBeNull();
  });

  it('marks free_shipping without merchandise discount', () => {
    const result = computeRuleDiscount(
      rule({ code: 'FREESHIP', kind: 'free_shipping' }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'free_shipping',
    );
    expect(result.discountMinor).toBe(0n);
    expect(result.freeShipping).toBe(true);
    expect(result.application?.freeShipping).toBe(true);
  });

  it('skips bxgy until follow-on', () => {
    const result = computeRuleDiscount(
      rule({ code: 'BXGY', kind: 'bxgy' }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'bxgy',
    );
    expect(result.discountMinor).toBe(0n);
  });

  it('merges coupon + automatic and caps at subtotal', () => {
    const coupon = computeRuleDiscount(
      rule({ code: 'SAVE10', kind: 'percentage', valueBps: 1000 }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'coupon',
    );
    const auto = computeRuleDiscount(
      rule({
        code: 'AUTO100',
        kind: 'fixed_amount',
        amountMinor: '100',
        currencyCode: 'USD',
      }),
      { currencyCode: 'USD', subtotalMinor: '2000' },
      'automatic',
    );
    const merged = mergePromotionApplications('USD', 2000n, [coupon, auto]);
    expect(merged.discountMinor).toBe('300');
    expect(merged.applications).toHaveLength(2);
  });

  it('selectAutomaticRules prefers higher-priority non-stackable', () => {
    const rules = [
      {
        code: 'STACK',
        priority: 5,
        stackable: true,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        code: 'EXCLUSIVE',
        priority: 10,
        stackable: false,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
    ] as DiscountRuleEntity[];

    expect(selectAutomaticRules(rules).map((r) => r.code)).toEqual(['EXCLUSIVE']);
  });

  it('selectAutomaticRules stacks when stackables outrank non-stackable', () => {
    const rules = [
      {
        code: 'STACK_A',
        priority: 20,
        stackable: true,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        code: 'STACK_B',
        priority: 15,
        stackable: true,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        code: 'EXCLUSIVE',
        priority: 10,
        stackable: false,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
    ] as DiscountRuleEntity[];

    expect(selectAutomaticRules(rules).map((r) => r.code)).toEqual(['STACK_A', 'STACK_B']);
  });
});
