import { describe, expect, it } from 'vitest';

import { PromotionsEngine } from './promotions-engine.service';
import { PromotionRuleRegistry } from './promotion-rule.registry';
import type { PromotionApplyInput, PromotionRuleProvider } from './promotion-rule';

const sampleInput: PromotionApplyInput = {
  currencyCode: 'USD',
  items: [{ quantity: 2, unitAmountMinor: '1000', variantId: 'v1' }],
  subtotalMinor: '2000',
  shippingMinor: '500',
  couponCode: 'SAVE10',
};

function stubProvider(
  overrides: Partial<PromotionRuleProvider> &
    Pick<PromotionRuleProvider, 'code' | 'displayName'> = {
    code: 'coupon',
    displayName: 'Coupon',
  },
): PromotionRuleProvider {
  return {
    async apply(input) {
      return {
        currencyCode: input.currencyCode,
        discountMinor: '0',
        applications: [],
      };
    },
    ...overrides,
  };
}

describe('PromotionsEngine', () => {
  it('register / get / list providers by code', () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    engine.register(stubProvider());
    expect(engine.get('coupon')?.displayName).toBe('Coupon');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new PromotionRuleRegistry();
    registry.register('a', stubProvider({ code: 'coupon', displayName: 'A' }));
    expect(() =>
      registry.register('b', stubProvider({ code: 'coupon', displayName: 'B' })),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new PromotionRuleRegistry();
    registry.register('plugin-coupon', stubProvider({ code: 'coupon', displayName: 'Coupon' }));
    registry.deactivatePlugin('plugin-coupon');
    expect(new PromotionsEngine(registry).get('coupon')).toBeUndefined();
    registry.activatePlugin('plugin-coupon');
    expect(new PromotionsEngine(registry).get('coupon')).toBeDefined();
    registry.removePlugin('plugin-coupon');
    expect(registry.list()).toHaveLength(0);
  });

  it('aggregates discounts from multiple providers and caps at subtotal (D-01)', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    engine.register(
      stubProvider({
        code: 'coupon',
        displayName: 'Coupon',
        async apply(input) {
          return {
            currencyCode: input.currencyCode,
            discountMinor: '200',
            applications: [
              {
                code: 'SAVE10',
                kind: 'coupon',
                discountMinor: '200',
                label: '10% off',
              },
            ],
          };
        },
      }),
    );
    engine.register(
      stubProvider({
        code: 'discount',
        displayName: 'Automatic discount',
        async apply(input) {
          return {
            currencyCode: input.currencyCode,
            discountMinor: '100',
            applications: [
              {
                code: 'AUTO100',
                kind: 'automatic',
                discountMinor: '100',
              },
            ],
          };
        },
      }),
    );

    const result = await engine.apply(sampleInput);
    expect(result.discountMinor).toBe('300');
    expect(result.applications).toHaveLength(2);
  });

  it('caps aggregated discount at merchandise subtotal', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    engine.register(
      stubProvider({
        code: 'coupon',
        displayName: 'Coupon',
        async apply(input) {
          return {
            currencyCode: input.currencyCode,
            discountMinor: '9999',
            applications: [{ code: 'HUGE', kind: 'coupon', discountMinor: '9999' }],
          };
        },
      }),
    );

    const result = await engine.apply(sampleInput);
    expect(result.discountMinor).toBe('2000');
  });

  it('propagates freeShipping from any provider', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    engine.register(
      stubProvider({
        code: 'freeship',
        displayName: 'Free shipping',
        async apply(input) {
          return {
            currencyCode: input.currencyCode,
            discountMinor: '0',
            freeShipping: true,
            applications: [
              {
                code: 'FREESHIP',
                kind: 'free_shipping',
                discountMinor: '0',
                freeShipping: true,
              },
            ],
          };
        },
      }),
    );

    const result = await engine.apply(sampleInput);
    expect(result.freeShipping).toBe(true);
  });

  it('applyOrZero returns zero discount when no provider (D-01)', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    const result = await engine.applyOrZero(sampleInput);
    expect(result.discountMinor).toBe('0');
    expect(result.applications).toEqual([]);
    expect(result.freeShipping).toBe(false);
  });

  it('throws when no provider is registered for apply()', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    await expect(engine.apply(sampleInput)).rejects.toThrow(/No active promotion rule provider/);
  });

  it('rejects invalid apply input', async () => {
    const engine = new PromotionsEngine(new PromotionRuleRegistry());
    engine.register(stubProvider());
    await expect(
      engine.apply({
        currencyCode: '',
        items: [{ quantity: 1, unitAmountMinor: '100' }],
      }),
    ).rejects.toThrow(/currencyCode/);
    await expect(
      engine.apply({
        currencyCode: 'USD',
        items: [],
      }),
    ).rejects.toThrow(/items/);
  });
});
