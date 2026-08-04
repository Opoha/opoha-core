import { describe, expect, it, vi } from 'vitest';

import { TypeOrmPromotionProvider } from './typeorm-promotion.provider';
import type { CouponEntity } from './entities/coupon.entity';
import type { DiscountRuleEntity } from './entities/discount-rule.entity';
import type { PromotionApplyInput } from './promotion-rule';

const sampleInput: PromotionApplyInput = {
  currencyCode: 'USD',
  items: [{ quantity: 2, unitAmountMinor: '1000', variantId: 'v1' }],
  subtotalMinor: '2000',
  shippingMinor: '500',
};

function mockRepo<T>(rows: T[] = []) {
  return {
    findOne: vi.fn(async ({ where }: { where: Partial<T> }) => {
      return (
        rows.find((row) =>
          Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v),
        ) ?? null
      );
    }),
    find: vi.fn(async () => rows),
  };
}

describe('TypeOrmPromotionProvider (D-03)', () => {
  it('applies coupon + automatic discount into totals', async () => {
    const coupon: CouponEntity = {
      id: 'c1',
      code: 'SAVE10',
      name: '10% off',
      description: null,
      kind: 'percentage',
      valueBps: 1000,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      maxUses: null,
      maxUsesPerCustomer: null,
      usageCount: 0,
      priority: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const auto: DiscountRuleEntity = {
      id: 'd1',
      code: 'AUTO100',
      name: '$1 off',
      description: null,
      kind: 'fixed_amount',
      valueBps: null,
      amountMinor: '100',
      currencyCode: 'USD',
      minSubtotalMinor: null,
      priority: 10,
      stackable: true,
      startsAt: null,
      endsAt: null,
      isActive: true,
      conditions: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const coupons = mockRepo([coupon]);
    const rules = mockRepo([auto]);
    const provider = new TypeOrmPromotionProvider(coupons as never, rules as never);

    const result = await provider.apply({
      ...sampleInput,
      couponCode: 'save10',
    });

    expect(result.discountMinor).toBe('300');
    expect(result.applications.map((a) => a.code).sort()).toEqual(['AUTO100', 'SAVE10']);
    expect(coupons.findOne).toHaveBeenCalled();
  });

  it('throws on unknown coupon code', async () => {
    const provider = new TypeOrmPromotionProvider(mockRepo([]) as never, mockRepo([]) as never);
    await expect(provider.apply({ ...sampleInput, couponCode: 'NOPE' })).rejects.toThrow(
      /not valid/,
    );
  });

  it('applies automatic-only when no coupon', async () => {
    const auto: DiscountRuleEntity = {
      id: 'd1',
      code: 'AUTO10',
      name: '10% auto',
      description: null,
      kind: 'percentage',
      valueBps: 1000,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      priority: 1,
      stackable: false,
      startsAt: null,
      endsAt: null,
      isActive: true,
      conditions: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const provider = new TypeOrmPromotionProvider(mockRepo([]) as never, mockRepo([auto]) as never);

    const result = await provider.apply(sampleInput);
    expect(result.discountMinor).toBe('200');
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]?.kind).toBe('automatic');
  });

  it('applies free_shipping coupon', async () => {
    const coupon: CouponEntity = {
      id: 'c1',
      code: 'FREESHIP',
      name: 'Free shipping',
      description: null,
      kind: 'free_shipping',
      valueBps: null,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      maxUses: null,
      maxUsesPerCustomer: null,
      usageCount: 0,
      priority: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const provider = new TypeOrmPromotionProvider(
      mockRepo([coupon]) as never,
      mockRepo([]) as never,
    );

    const result = await provider.apply({
      ...sampleInput,
      couponCode: 'FREESHIP',
    });
    expect(result.freeShipping).toBe(true);
    expect(result.discountMinor).toBe('0');
  });

  it('rejects coupon when customer fails segment restriction (E-03)', async () => {
    const coupon: CouponEntity = {
      id: 'c1',
      code: 'VIP10',
      name: 'VIP 10%',
      description: null,
      kind: 'percentage',
      valueBps: 1000,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      maxUses: null,
      maxUsesPerCustomer: null,
      usageCount: 0,
      priority: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      metadata: { segmentCodes: ['vip'] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const segments = {
      customerMatchesSegment: vi.fn(),
      findByCode: vi.fn(async () => ({
        id: 'seg-1',
        code: 'vip',
        name: 'VIP',
        description: null,
        rules: { tags: { any: ['vip'] } },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      evaluateRules: vi.fn(() => false),
    };

    const provider = new TypeOrmPromotionProvider(
      mockRepo([coupon]) as never,
      mockRepo([]) as never,
      segments as never,
    );

    await expect(
      provider.apply({
        ...sampleInput,
        couponCode: 'VIP10',
        customerId: 'cust-1',
        metadata: { tags: ['regular'] },
      }),
    ).rejects.toThrow(/not available for this customer segment/);
  });

  it('applies coupon when customer matches segment restriction (E-03)', async () => {
    const coupon: CouponEntity = {
      id: 'c1',
      code: 'VIP10',
      name: 'VIP 10%',
      description: null,
      kind: 'percentage',
      valueBps: 1000,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      maxUses: null,
      maxUsesPerCustomer: null,
      usageCount: 0,
      priority: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      metadata: { segmentCodes: ['vip'] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const segments = {
      customerMatchesSegment: vi.fn(),
      findByCode: vi.fn(async () => ({
        id: 'seg-1',
        code: 'vip',
        name: 'VIP',
        description: null,
        rules: { tags: { any: ['vip'] } },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      evaluateRules: vi.fn(() => true),
    };

    const provider = new TypeOrmPromotionProvider(
      mockRepo([coupon]) as never,
      mockRepo([]) as never,
      segments as never,
    );

    const result = await provider.apply({
      ...sampleInput,
      couponCode: 'VIP10',
      customerId: 'cust-1',
      metadata: { tags: ['vip'] },
    });
    expect(result.discountMinor).toBe('200');
    expect(segments.evaluateRules).toHaveBeenCalled();
  });

  it('skips automatic discount when segment restriction fails (E-03)', async () => {
    const auto: DiscountRuleEntity = {
      id: 'd1',
      code: 'VIPAUTO',
      name: 'VIP auto',
      description: null,
      kind: 'percentage',
      valueBps: 1000,
      amountMinor: null,
      currencyCode: null,
      minSubtotalMinor: null,
      priority: 1,
      stackable: false,
      startsAt: null,
      endsAt: null,
      isActive: true,
      conditions: { segmentIds: ['seg-vip'] },
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const segments = {
      customerMatchesSegment: vi.fn(async () => false),
      findByCode: vi.fn(),
      evaluateRules: vi.fn(),
    };

    const provider = new TypeOrmPromotionProvider(
      mockRepo([]) as never,
      mockRepo([auto]) as never,
      segments as never,
    );

    const result = await provider.apply({
      ...sampleInput,
      customerId: 'cust-1',
    });
    expect(result.discountMinor).toBe('0');
    expect(result.applications).toHaveLength(0);
  });
});
