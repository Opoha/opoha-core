import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  CURRENCY_ROUNDING_MODE,
  convertMinorWithRate,
  type CurrencyRoundingMode,
} from './currency-conversion';
import { ExchangeRateService } from './exchange-rate.service';
import { StoreCurrencyConfigService } from './store-currency-config.service';

const CURRENCY_RE = /^[A-Z]{3}$/;

function assertCurrencyCode(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid ${field} "${value}" (expected ISO 4217)`);
  }
  return normalized;
}

export type ConvertedAmount = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  amountMinor: string;
  convertedMinor: string;
  roundingMode: CurrencyRoundingMode;
};

export type DisplayTotalsInput = {
  currencyCode: string;
  subtotalMinor: string;
  discountMinor: string;
  giftCardMinor: string;
  loyaltyMinor: string;
  taxMinor: string;
  shippingMinor: string;
  totalMinor: string;
};

export type DisplayTotalsResult = DisplayTotalsInput & {
  /** Settlement (source) currency — same as input.currencyCode. */
  settlementCurrencyCode: string;
  displayCurrencyCode: string;
  rate: number;
  roundingMode: CurrencyRoundingMode;
};

/**
 * Converts settlement minor amounts to an allowed store display currency
 * using configured exchange rates.
 */
@Injectable()
export class CurrencyConversionService {
  constructor(
    private readonly rates: ExchangeRateService,
    private readonly storeCurrency: StoreCurrencyConfigService,
  ) {}

  /**
   * Resolve display currency for a store: explicit arg, else store primary
   * display currency. Validates against enabled display list.
   */
  async resolveDisplayCurrency(
    storeId: string,
    displayCurrencyCode?: string | null,
  ): Promise<string> {
    const config = await this.storeCurrency.getForStore(storeId);
    if (!displayCurrencyCode?.trim()) {
      return config.displayCurrencyCode;
    }
    const code = assertCurrencyCode(displayCurrencyCode, 'displayCurrencyCode');
    const allowed = await this.storeCurrency.isDisplayCurrencyAllowed(storeId, code);
    if (!allowed) {
      throw new BadRequestException(`Display currency ${code} is not enabled for store ${storeId}`);
    }
    return code;
  }

  /**
   * Convert one minor-unit amount. Same-currency returns identity with rate 1.
   */
  async convertAmount(
    amountMinor: string | number | bigint,
    fromCurrencyCode: string,
    toCurrencyCode: string,
  ): Promise<ConvertedAmount> {
    const from = assertCurrencyCode(fromCurrencyCode, 'fromCurrencyCode');
    const to = assertCurrencyCode(toCurrencyCode, 'toCurrencyCode');
    const rate = await this.rates.getRate(from, to);
    const amount = String(amountMinor);
    return {
      fromCurrencyCode: from,
      toCurrencyCode: to,
      rate,
      amountMinor: amount,
      convertedMinor: convertMinorWithRate(amount, rate),
      roundingMode: CURRENCY_ROUNDING_MODE,
    };
  }

  /**
   * Convert checkout / cart totals from settlement currency to display.
   * Throws NotFoundException when a required cross-currency rate is missing.
   */
  async convertTotals(
    storeId: string,
    totals: DisplayTotalsInput,
    displayCurrencyCode?: string | null,
  ): Promise<DisplayTotalsResult> {
    const settlement = assertCurrencyCode(totals.currencyCode, 'currencyCode');
    const display = await this.resolveDisplayCurrency(storeId, displayCurrencyCode);

    if (settlement === display) {
      return {
...totals,
        currencyCode: display,
        settlementCurrencyCode: settlement,
        displayCurrencyCode: display,
        rate: 1,
        roundingMode: CURRENCY_ROUNDING_MODE,
      };
    }

    let rate: number;
    try {
      rate = await this.rates.getRate(settlement, display);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `No exchange rate configured for ${settlement}→${display}; ` +
            `set a manual rate before using display currency ${display}`,
        );
      }
      throw error;
    }

    const convert = (minor: string) => convertMinorWithRate(minor, rate);

    return {
      currencyCode: display,
      subtotalMinor: convert(totals.subtotalMinor),
      discountMinor: convert(totals.discountMinor),
      giftCardMinor: convert(totals.giftCardMinor),
      loyaltyMinor: convert(totals.loyaltyMinor),
      taxMinor: convert(totals.taxMinor),
      shippingMinor: convert(totals.shippingMinor),
      totalMinor: convert(totals.totalMinor),
      settlementCurrencyCode: settlement,
      displayCurrencyCode: display,
      rate,
      roundingMode: CURRENCY_ROUNDING_MODE,
    };
  }
}
