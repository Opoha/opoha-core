import { describe, expect, it } from 'vitest';

import { TaxEngine } from './tax-engine.service';
import { TaxProviderRegistry } from './tax-provider.registry';
import type { TaxCalculateInput, TaxProvider } from './tax-provider';

const sampleExclusiveInput: TaxCalculateInput = {
  currencyCode: 'USD',
  pricingMode: 'exclusive',
  address: { countryCode: 'US', postalCode: '10001' },
  items: [{ quantity: 1, unitAmountMinor: '1000', taxClassCode: 'standard' }],
  subtotalMinor: '1000',
};

const sampleInclusiveInput: TaxCalculateInput = {
  ...sampleExclusiveInput,
  pricingMode: 'inclusive',
};

function stubProvider(
  overrides: Partial<TaxProvider> & Pick<TaxProvider, 'code' | 'displayName'> = {
    code: 'standard',
    displayName: 'Standard tax',
  },
): TaxProvider {
  return {
    async calculateTax(input) {
      return {
        currencyCode: input.currencyCode,
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      };
    },
    ...overrides,
  };
}

describe('TaxEngine', () => {
  it('register / get / list providers by code', () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    engine.register(stubProvider());
    expect(engine.get('standard')?.displayName).toBe('Standard tax');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new TaxProviderRegistry();
    registry.register('a', stubProvider({ code: 'standard', displayName: 'A' }));
    expect(() =>
      registry.register('b', stubProvider({ code: 'standard', displayName: 'B' })),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new TaxProviderRegistry();
    registry.register(
      'tax-standard',
      stubProvider({ code: 'standard', displayName: 'Standard tax' }),
    );
    registry.deactivatePlugin('tax-standard');
    expect(new TaxEngine(registry).get('standard')).toBeUndefined();
    registry.activatePlugin('tax-standard');
    expect(new TaxEngine(registry).get('standard')).toBeDefined();
    registry.removePlugin('tax-standard');
    expect(registry.list()).toHaveLength(0);
  });

  it('invokes calculateTax for exclusive pricing (C-01)', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    engine.register(
      stubProvider({
        code: 'standard',
        displayName: 'Standard tax',
        async calculateTax(input) {
          const subtotal = BigInt(input.subtotalMinor ?? '0');
          const tax = (subtotal * 1000n) / 10000n; // 10%
          return {
            currencyCode: input.currencyCode,
            pricingMode: input.pricingMode,
            taxMinor: tax.toString(),
            netMinor: subtotal.toString(),
            grossMinor: (subtotal + tax).toString(),
            lines: [
              {
                lineIndex: 0,
                taxClassCode: 'standard',
                rateBps: 1000,
                taxAmountMinor: tax.toString(),
                taxableAmountMinor: subtotal.toString(),
                name: 'VAT 10%',
              },
            ],
          };
        },
      }),
    );

    const result = await engine.calculate(sampleExclusiveInput);
    expect(result).toEqual({
      currencyCode: 'USD',
      pricingMode: 'exclusive',
      taxMinor: '100',
      netMinor: '1000',
      grossMinor: '1100',
      lines: [
        {
          lineIndex: 0,
          taxClassCode: 'standard',
          rateBps: 1000,
          taxAmountMinor: '100',
          taxableAmountMinor: '1000',
          name: 'VAT 10%',
        },
      ],
    });
  });

  it('invokes calculateTax for inclusive pricing (C-01)', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    engine.register(
      stubProvider({
        code: 'standard',
        displayName: 'Standard tax',
        async calculateTax(input) {
          const gross = BigInt(input.subtotalMinor ?? '0');
          // tax = gross - gross / (1 + rate); rate 10% → tax = gross * 1000/11000
          const tax = (gross * 1000n) / 11000n;
          const net = gross - tax;
          return {
            currencyCode: input.currencyCode,
            pricingMode: input.pricingMode,
            taxMinor: tax.toString(),
            netMinor: net.toString(),
            grossMinor: gross.toString(),
            lines: [
              {
                lineIndex: 0,
                rateBps: 1000,
                taxAmountMinor: tax.toString(),
                taxableAmountMinor: net.toString(),
              },
            ],
          };
        },
      }),
    );

    const result = await engine.calculate(sampleInclusiveInput);
    expect(result.pricingMode).toBe('inclusive');
    expect(result.taxMinor).toBe('90');
    expect(result.netMinor).toBe('910');
    expect(result.grossMinor).toBe('1000');
  });

  it('requires providerCode when multiple providers are active', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    engine.register(stubProvider({ code: 'a', displayName: 'A' }));
    engine.register(stubProvider({ code: 'b', displayName: 'B' }));
    await expect(engine.calculate(sampleExclusiveInput)).rejects.toThrow(/Multiple tax providers/);
    const result = await engine.calculate(sampleExclusiveInput, 'a');
    expect(result.taxMinor).toBe('0');
  });

  it('throws when no provider is registered', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    await expect(engine.calculate(sampleExclusiveInput)).rejects.toThrow(/No active tax provider/);
  });

  it('calculateOrZero returns zero tax when no provider (C-03)', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    const result = await engine.calculateOrZero(sampleExclusiveInput);
    expect(result.taxMinor).toBe('0');
    expect(result.pricingMode).toBe('exclusive');
    expect(result.lines).toEqual([]);
  });

  it('rejects invalid calculate input', async () => {
    const engine = new TaxEngine(new TaxProviderRegistry());
    engine.register(stubProvider());
    await expect(
      engine.calculate({
        currencyCode: '',
        pricingMode: 'exclusive',
        items: [{ quantity: 1, unitAmountMinor: '100' }],
      }),
    ).rejects.toThrow(/currencyCode/);
    await expect(
      engine.calculate({
        currencyCode: 'USD',
        pricingMode: 'exclusive',
        items: [],
      }),
    ).rejects.toThrow(/items/);
  });
});
