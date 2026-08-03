import { describe, expect, it } from 'vitest';

import {
  buildPromotionApplyInput,
  buildTaxCalculateInput,
  resolveCartPricingMode,
  totalsWithTax,
} from './checkout-tax';
import type { CartEntity } from './entities/cart.entity';
import type { CartLineEntity } from './entities/cart-line.entity';

describe('checkout-tax helpers (C-03 / D-01)', () => {
  const cart = {
    id: 'c1',
    currencyCode: 'USD',
    shippingMinor: '100',
    taxPricingMode: 'exclusive',
    taxCountryCode: 'US',
    taxPostalCode: '10001',
    taxProvince: null,
    taxProviderCode: null,
    couponCode: 'SAVE10',
    discountMinor: '0',
  } as CartEntity;

  const lines = [
    {
      variantId: 'v1',
      quantity: 2,
      unitPriceMinor: '1000',
    },
  ] as CartLineEntity[];

  it('resolveCartPricingMode reads cart then env', () => {
    expect(resolveCartPricingMode(cart)).toBe('exclusive');
    expect(
      resolveCartPricingMode({
        ...cart,
        taxPricingMode: 'inclusive',
      } as CartEntity),
    ).toBe('inclusive');
  });

  it('buildTaxCalculateInput maps lines + address', () => {
    const input = buildTaxCalculateInput(cart, lines);
    expect(input.currencyCode).toBe('USD');
    expect(input.pricingMode).toBe('exclusive');
    expect(input.subtotalMinor).toBe('2000');
    expect(input.shippingMinor).toBe('100');
    expect(input.address?.countryCode).toBe('US');
    expect(input.address?.postalCode).toBe('10001');
    expect(input.items).toEqual([
      {
        variantId: 'v1',
        quantity: 2,
        unitAmountMinor: '1000',
        taxClassCode: 'standard',
      },
    ]);
  });

  it('buildPromotionApplyInput maps lines + coupon (D-01)', () => {
    const input = buildPromotionApplyInput(cart, lines);
    expect(input.currencyCode).toBe('USD');
    expect(input.subtotalMinor).toBe('2000');
    expect(input.shippingMinor).toBe('100');
    expect(input.couponCode).toBe('SAVE10');
    expect(input.items).toEqual([
      {
        variantId: 'v1',
        quantity: 2,
        unitAmountMinor: '1000',
      },
    ]);
  });

  it('totalsWithTax adds exclusive tax', () => {
    const totals = totalsWithTax({
      currencyCode: 'USD',
      subtotalMinor: 2000n,
      shippingMinor: 100n,
      tax: { taxMinor: '200', pricingMode: 'exclusive' },
    });
    expect(totals.totalMinor).toBe('2300');
    expect(totals.taxMinor).toBe('200');
    expect(totals.discountMinor).toBe('0');
  });

  it('totalsWithTax does not add inclusive tax to total', () => {
    const totals = totalsWithTax({
      currencyCode: 'USD',
      subtotalMinor: 2000n,
      shippingMinor: 100n,
      tax: { taxMinor: '181', pricingMode: 'inclusive' },
    });
    expect(totals.totalMinor).toBe('2100');
    expect(totals.taxMinor).toBe('181');
  });

  it('totalsWithTax subtracts discount and honors freeShipping (D-01)', () => {
    const totals = totalsWithTax({
      currencyCode: 'USD',
      subtotalMinor: 2000n,
      shippingMinor: 500n,
      tax: { taxMinor: '0', pricingMode: 'exclusive' },
      discountMinor: 300n,
      freeShipping: true,
    });
    expect(totals.discountMinor).toBe('300');
    expect(totals.shippingMinor).toBe('0');
    expect(totals.totalMinor).toBe('1700');
  });
});
