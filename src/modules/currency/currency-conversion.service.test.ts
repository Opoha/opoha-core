import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CURRENCY_ROUNDING_MODE,
  convertMinorWithRate,
  roundHalfUpToMinor,
} from './currency-conversion';
import { CurrencyConversionService } from './currency-conversion.service';
import type { ExchangeRateService } from './exchange-rate.service';
import type { StoreCurrencyConfigService } from './store-currency-config.service';

describe('currency-conversion (pure)', () => {
  it('identity when rate is 1', () => {
    expect(convertMinorWithRate('1999', 1)).toBe('1999');
  });

  it('multiplies and half-ups (0.5 → up)', () => {
    // 100 * 1.005 = 100.5 → 101
    expect(convertMinorWithRate('100', 1.005)).toBe('101');
    // 100 * 1.004 = 100.4 → 100
    expect(convertMinorWithRate('100', 1.004)).toBe('100');
  });

  it('roundHalfUpToMinor matches Math.round for positives', () => {
    expect(roundHalfUpToMinor(10.5)).toBe(11n);
    expect(roundHalfUpToMinor(10.4)).toBe(10n);
  });
});

describe('CurrencyConversionService (unit)', () => {
  let rates: { getRate: ReturnType<typeof vi.fn> };
  let storeCurrency: {
    getForStore: ReturnType<typeof vi.fn>;
    isDisplayCurrencyAllowed: ReturnType<typeof vi.fn>;
  };
  let service: CurrencyConversionService;

  beforeEach(() => {
    rates = {
      getRate: vi.fn(async (from: string, to: string) => {
        if (from === to) return 1;
        if (from === 'USD' && to === 'EUR') return 0.9;
        throw new Error(`missing ${from}→${to}`);
      }),
    };
    storeCurrency = {
      getForStore: vi.fn(async () => ({
        storeId: 'store-1',
        settlementCurrencyCode: 'USD',
        displayCurrencyCode: 'EUR',
        enabledDisplayCurrencies: ['EUR', 'USD', 'GBP'],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      isDisplayCurrencyAllowed: vi.fn(async (_storeId: string, code: string) =>
        ['EUR', 'USD', 'GBP'].includes(code),
      ),
    };
    service = new CurrencyConversionService(
      rates as unknown as ExchangeRateService,
      storeCurrency as unknown as StoreCurrencyConfigService,
    );
  });

  it('resolves primary display when arg omitted', async () => {
    await expect(service.resolveDisplayCurrency('store-1')).resolves.toBe('EUR');
  });

  it('rejects disabled display currency', async () => {
    storeCurrency.isDisplayCurrencyAllowed.mockResolvedValue(false);
    await expect(service.resolveDisplayCurrency('store-1', 'JPY')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('convertAmount applies rate with half-up rounding', async () => {
    const result = await service.convertAmount('1000', 'USD', 'EUR');
    expect(result.convertedMinor).toBe('900');
    expect(result.rate).toBe(0.9);
    expect(result.roundingMode).toBe(CURRENCY_ROUNDING_MODE);
  });

  it('convertTotals converts all fields and records settlement', async () => {
    const display = await service.convertTotals(
      'store-1',
      {
        currencyCode: 'USD',
        subtotalMinor: '2500',
        discountMinor: '100',
        giftCardMinor: '0',
        loyaltyMinor: '0',
        taxMinor: '200',
        shippingMinor: '500',
        totalMinor: '3100',
      },
      'EUR',
    );

    expect(display.settlementCurrencyCode).toBe('USD');
    expect(display.displayCurrencyCode).toBe('EUR');
    expect(display.currencyCode).toBe('EUR');
    expect(display.subtotalMinor).toBe('2250');
    expect(display.discountMinor).toBe('90');
    expect(display.taxMinor).toBe('180');
    expect(display.shippingMinor).toBe('450');
    expect(display.totalMinor).toBe('2790');
    expect(display.rate).toBe(0.9);
    expect(display.roundingMode).toBe('half_up');
  });

  it('convertTotals identity when display equals settlement', async () => {
    const display = await service.convertTotals(
      'store-1',
      {
        currencyCode: 'USD',
        subtotalMinor: '100',
        discountMinor: '0',
        giftCardMinor: '0',
        loyaltyMinor: '0',
        taxMinor: '0',
        shippingMinor: '0',
        totalMinor: '100',
      },
      'USD',
    );
    expect(display.totalMinor).toBe('100');
    expect(display.rate).toBe(1);
    expect(rates.getRate).not.toHaveBeenCalled();
  });
});
