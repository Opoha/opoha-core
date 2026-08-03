import { describe, expect, it } from 'vitest';

import { ShippingEngine } from './shipping-engine.service';
import { ShippingMethodRegistry } from './shipping-method.registry';
import type {
  ShippingMethodProvider,
  ShippingQuoteInput,
} from './shipping-method';

const sampleQuoteInput: ShippingQuoteInput = {
  currencyCode: 'USD',
  destination: { countryCode: 'US', postalCode: '10001' },
  items: [{ quantity: 1, unitAmountMinor: '1000' }],
  subtotalMinor: '1000',
};

function stubMethod(
  overrides: Partial<ShippingMethodProvider> &
    Pick<ShippingMethodProvider, 'code' | 'displayName'> = {
    code: 'flat-rate',
    displayName: 'Flat rate',
  },
): ShippingMethodProvider {
  return {
    async quoteRates() {
      return [];
    },
    ...overrides,
  };
}

describe('ShippingEngine', () => {
  it('register / get / list methods by code', () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(stubMethod());
    expect(engine.get('flat-rate')?.displayName).toBe('Flat rate');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new ShippingMethodRegistry();
    registry.register('a', stubMethod({ code: 'flat-rate', displayName: 'A' }));
    expect(() =>
      registry.register(
        'b',
        stubMethod({ code: 'flat-rate', displayName: 'B' }),
      ),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new ShippingMethodRegistry();
    registry.register(
      'shipping-flat-rate',
      stubMethod({ code: 'flat-rate', displayName: 'Flat rate' }),
    );
    registry.deactivatePlugin('shipping-flat-rate');
    expect(new ShippingEngine(registry).get('flat-rate')).toBeUndefined();
    registry.activatePlugin('shipping-flat-rate');
    expect(new ShippingEngine(registry).get('flat-rate')).toBeDefined();
    registry.removePlugin('shipping-flat-rate');
    expect(registry.list()).toHaveLength(0);
  });

  it('invokes quoteRates on registered method (B-01)', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates(input) {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: {
                amountMinor: '500',
                currencyCode: input.currencyCode,
              },
            },
          ];
        },
      }),
    );
    const method = engine.get('flat-rate');
    expect(method).toBeDefined();
    const rates = await method!.quoteRates(sampleQuoteInput);
    expect(rates).toEqual([
      {
        code: 'flat-rate',
        displayName: 'Flat rate',
        amount: { amountMinor: '500', currencyCode: 'USD' },
      },
    ]);
  });

  it('supports optional createLabel / voidLabel hooks', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'carrier',
        displayName: 'Carrier',
        async createLabel() {
          return {
            status: 'created',
            trackingNumber: 'TRACK-1',
            labelUrl: 'https://example.test/label.pdf',
          };
        },
        async voidLabel() {
          return { status: 'voided' };
        },
      }),
    );
    const method = engine.get('carrier')!;
    const label = await method.createLabel!({
      orderId: 'ord_1',
      rateCode: 'express',
      destination: { countryCode: 'US' },
      items: [{ quantity: 1, unitAmountMinor: '1000' }],
      amount: { amountMinor: '1200', currencyCode: 'USD' },
    });
    expect(label.status).toBe('created');
    expect(label.trackingNumber).toBe('TRACK-1');
    const voided = await method.voidLabel!({ orderId: 'ord_1' });
    expect(voided.status).toBe('voided');
  });

  it('quote aggregates rates from all active methods (B-02)', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates(input) {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: {
                amountMinor: '500',
                currencyCode: input.currencyCode,
              },
            },
          ];
        },
      }),
    );
    engine.register(
      stubMethod({
        code: 'express',
        displayName: 'Express',
        async quoteRates(input) {
          return [
            {
              code: 'next-day',
              displayName: 'Next day',
              amount: {
                amountMinor: '1500',
                currencyCode: input.currencyCode,
              },
            },
          ];
        },
      }),
    );

    const result = await engine.quote(sampleQuoteInput);
    expect(result.currencyCode).toBe('USD');
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toMatchObject({
      methodCode: 'flat-rate',
      methodDisplayName: 'Flat rate',
      code: 'flat-rate',
      amount: { amountMinor: '500', currencyCode: 'USD' },
    });
    expect(result.rates[1]).toMatchObject({
      methodCode: 'express',
      code: 'next-day',
      amount: { amountMinor: '1500', currencyCode: 'USD' },
    });
  });

  it('quote returns rates from flat-rate and DHL carrier (shipping gate / B-05)', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates(input) {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: {
                amountMinor: '500',
                currencyCode: input.currencyCode,
              },
            },
          ];
        },
      }),
    );
    engine.register(
      stubMethod({
        code: 'dhl',
        displayName: 'DHL Express',
        async quoteRates(input) {
          return [
            {
              code: 'P',
              displayName: 'DHL EXPRESS WORLDWIDE',
              amount: {
                amountMinor: '2063',
                currencyCode: input.currencyCode,
              },
              minTransitDays: 3,
              maxTransitDays: 3,
            },
            {
              code: 'Y',
              displayName: 'DHL EXPRESS 12:00',
              amount: {
                amountMinor: '2655',
                currencyCode: input.currencyCode,
              },
              minTransitDays: 2,
              maxTransitDays: 2,
            },
          ];
        },
      }),
    );

    const result = await engine.quote(sampleQuoteInput);
    const methodCodes = new Set(result.rates.map((r) => r.methodCode));
    expect(methodCodes.has('flat-rate')).toBe(true);
    expect(methodCodes.has('dhl')).toBe(true);
    expect(result.rates.filter((r) => r.methodCode === 'dhl')).toHaveLength(2);
  });

  it('quote skips methods that throw', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'broken',
        displayName: 'Broken',
        async quoteRates() {
          throw new Error('carrier down');
        },
      }),
    );
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates() {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: { amountMinor: '0', currencyCode: 'USD' },
            },
          ];
        },
      }),
    );

    const result = await engine.quote(sampleQuoteInput);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0]?.methodCode).toBe('flat-rate');
  });

  it('findQuotedRate resolves a specific method + rate', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates() {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: { amountMinor: '799', currencyCode: 'USD' },
            },
          ];
        },
      }),
    );

    const rate = await engine.findQuotedRate(
      sampleQuoteInput,
      'flat-rate',
      'flat-rate',
    );
    expect(rate.methodCode).toBe('flat-rate');
    expect(rate.code).toBe('flat-rate');
    expect(rate.amount.amountMinor).toBe('799');
  });

  it('findQuotedRate rejects unknown rate codes', async () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register(
      stubMethod({
        code: 'flat-rate',
        displayName: 'Flat rate',
        async quoteRates() {
          return [
            {
              code: 'flat-rate',
              displayName: 'Flat rate',
              amount: { amountMinor: '500', currencyCode: 'USD' },
            },
          ];
        },
      }),
    );

    await expect(
      engine.findQuotedRate(sampleQuoteInput, 'flat-rate', 'overnight'),
    ).rejects.toThrow(/not available/);
  });
});
