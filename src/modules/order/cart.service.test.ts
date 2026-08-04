import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { CartService } from './cart.service';

type CartRow = {
  id: string;
  storeId: string;
  customerId: string | null;
  companyId: string | null;
  status: 'open' | 'locked' | 'converted' | 'abandoned';
  currencyCode: string;
  shippingMethodCode: string | null;
  shippingRateCode: string | null;
  shippingMinor: string;
  taxPricingMode: 'inclusive' | 'exclusive';
  taxCountryCode: string | null;
  taxPostalCode: string | null;
  taxProvince: string | null;
  taxProviderCode: string | null;
  taxMinor: string;
  couponCode: string | null;
  discountMinor: string;
  giftCardCode: string | null;
  giftCardMinor: string;
  loyaltyPointsToRedeem: number;
  loyaltyMinor: string;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: string;
  reservationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VariantRow = {
  id: string;
  priceMinor: string;
  isActive: boolean;
  product?: { storeId: string | null };
};

describe('CartService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let cartStore: CartRow[];
  let lineStore: LineRow[];
  let variantStore: VariantRow[];
  let cartSeq: number;
  let lineSeq: number;
  let service: CartService;
  let cartsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let linesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let variantsRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let shipping: {
    findQuotedRate: ReturnType<typeof vi.fn>;
  };
  let stores: {
    findById: ReturnType<typeof vi.fn>;
    findByCode: ReturnType<typeof vi.fn>;
    findDefault: ReturnType<typeof vi.fn>;
  };
  let storeCurrency: {
    getForStore: ReturnType<typeof vi.fn>;
  };
  let currencyConversion: {
    convertTotals: ReturnType<typeof vi.fn>;
  };
  let companies: {
    resolveUnitPriceMinor: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cartStore = [];
    lineStore = [];
    variantStore = [
      {
        id: 'var-1',
        priceMinor: '1999',
        isActive: true,
        product: { storeId: null },
      },
      {
        id: 'var-2',
        priceMinor: '500',
        isActive: false,
        product: { storeId: null },
      },
    ];
    cartSeq = 0;
    lineSeq = 0;

    cartsRepo = {
      find: vi.fn(async () => [...cartStore]),
      findOne: vi.fn(async ({ where }: { where: Partial<CartRow> }) => {
        return cartStore.find((r) => r.id === where.id) ?? null;
      }),
      create: vi.fn((data: Partial<CartRow>) => ({
        id: `cart-${++cartSeq}`,
        storeId: 'store-default',
        customerId: null,
        companyId: null,
        status: 'open' as const,
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
        taxPricingMode: 'exclusive' as const,
        taxCountryCode: null,
        taxPostalCode: null,
        taxProvince: null,
        taxProviderCode: null,
        taxMinor: '0',
        couponCode: null,
        discountMinor: '0',
        giftCardCode: null,
        giftCardMinor: '0',
        loyaltyPointsToRedeem: 0,
        loyaltyMinor: '0',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: CartRow) => {
        const idx = cartStore.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          cartStore[idx] = { ...row };
          return cartStore[idx];
        }
        cartStore.push({ ...row });
        return row;
      }),
      update: vi.fn(async (where: { id: string }, patch: Partial<CartRow>) => {
        const row = cartStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, patch);
      }),
    };

    linesRepo = {
      find: vi.fn(async ({ where }: { where: Partial<LineRow>; order?: unknown }) =>
        lineStore.filter((r) => r.cartId === where.cartId),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<LineRow> }) => {
        if (where.id) {
          return lineStore.find((r) => r.id === where.id) ?? null;
        }
        return (
          lineStore.find((r) => r.cartId === where.cartId && r.variantId === where.variantId) ??
          null
        );
      }),
      create: vi.fn((data: Partial<LineRow>) => ({
        id: `line-${++lineSeq}`,
        reservationId: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: LineRow) => {
        const idx = lineStore.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          lineStore[idx] = { ...row };
          return lineStore[idx];
        }
        lineStore.push({ ...row });
        return row;
      }),
      delete: vi.fn(async (id: string) => {
        lineStore = lineStore.filter((r) => r.id !== id);
      }),
      update: vi.fn(async (where: { id: string }, patch: Partial<LineRow>) => {
        const row = lineStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, patch);
      }),
    };

    variantsRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return variantStore.find((v) => v.id === where.id) ?? null;
      }),
    };

    eventBus = { publish: vi.fn(async () => undefined) };
    shipping = {
      findQuotedRate: vi.fn(async () => ({
        methodCode: 'flat-rate',
        methodDisplayName: 'Flat rate',
        code: 'flat-rate',
        displayName: 'Flat rate',
        amount: { amountMinor: '500', currencyCode: 'USD' },
      })),
    };

    stores = {
      findById: vi.fn(async (id: string) => ({
        id,
        isActive: true,
      })),
      findByCode: vi.fn(async () => ({ id: 'store-from-code', isActive: true })),
      findDefault: vi.fn(async () => ({
        id: 'store-default',
        isActive: true,
      })),
    };

    storeCurrency = {
      getForStore: vi.fn(async () => ({
        storeId: 'store-default',
        settlementCurrencyCode: 'USD',
        displayCurrencyCode: 'USD',
        enabledDisplayCurrencies: ['USD'],
        createdAt: now,
        updatedAt: now,
      })),
    };

    currencyConversion = {
      convertTotals: vi.fn(async (_storeId, totals) => ({
        ...totals,
        settlementCurrencyCode: totals.currencyCode,
        displayCurrencyCode: totals.currencyCode,
        rate: 1,
        roundingMode: 'half_up',
      })),
    };

    companies = {
      resolveUnitPriceMinor: vi.fn(
        async (_companyId: string | null, _variantId: string, catalog: string) => catalog,
      ),
    };

    service = new CartService(
      cartsRepo as never,
      linesRepo as never,
      variantsRepo as never,
      eventBus as never,
      shipping as never,
      stores as never,
      storeCurrency as never,
      currencyConversion as never,
      companies as never,
    );
  });

  it('creates a cart bound to the default store and publishes CartCreated', async () => {
    const cart = await service.create({});
    expect(cart.id).toBe('cart-1');
    expect(cart.storeId).toBe('store-default');
    expect(cart.status).toBe('open');
    expect(cart.shippingMinor).toBe('0');
    expect(cart.taxPricingMode).toBe('exclusive');
    expect(cart.taxMinor).toBe('0');
    expect(cart.lines).toEqual([]);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartCreated,
        aggregateId: 'cart-1',
        data: expect.objectContaining({ storeId: 'store-default' }),
      }),
    );
  });

  it('rejects addLine for a product owned by another store', async () => {
    await service.create({ storeId: 'store-a' });
    variantStore.push({
      id: 'var-owned-b',
      priceMinor: '100',
      isActive: true,
      product: { storeId: 'store-b' },
    });

    await expect(
      service.addLine({
        cartId: 'cart-1',
        variantId: 'var-owned-b',
        quantity: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('setTaxContext persists pricing mode and jurisdiction', async () => {
    await service.create({});
    const cart = await service.setTaxContext({
      cartId: 'cart-1',
      pricingMode: 'inclusive',
      countryCode: 'th',
      postalCode: '10110',
      province: 'Bangkok',
    });
    expect(cart.taxPricingMode).toBe('inclusive');
    expect(cart.taxCountryCode).toBe('TH');
    expect(cart.taxPostalCode).toBe('10110');
    expect(cart.taxProvince).toBe('Bangkok');
  });

  it('selectShipping persists method/rate from ShippingEngine', async () => {
    await service.create({});
    await service.addLine({
      cartId: 'cart-1',
      variantId: 'var-1',
      quantity: 1,
    });

    const cart = await service.selectShipping({
      cartId: 'cart-1',
      methodCode: 'flat-rate',
      rateCode: 'flat-rate',
      destinationCountryCode: 'US',
      destinationPostalCode: '10001',
    });

    expect(shipping.findQuotedRate).toHaveBeenCalled();
    expect(cart.shippingMethodCode).toBe('flat-rate');
    expect(cart.shippingRateCode).toBe('flat-rate');
    expect(cart.shippingMinor).toBe('500');
  });

  it('adds and merges cart lines with price snapshot', async () => {
    await service.create({});
    let cart = await service.addLine({
      cartId: 'cart-1',
      variantId: 'var-1',
      quantity: 2,
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(2);
    expect(cart.lines[0]?.unitPriceMinor).toBe('1999');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartLineAdded,
        data: expect.objectContaining({
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 2,
        }),
      }),
    );

    cart = await service.addLine({
      cartId: 'cart-1',
      variantId: 'var-1',
      quantity: 1,
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartLineUpdated,
        data: expect.objectContaining({
          cartId: 'cart-1',
          quantity: 3,
        }),
      }),
    );
  });

  it('updates and removes cart lines', async () => {
    await service.create({});
    await service.addLine({
      cartId: 'cart-1',
      variantId: 'var-1',
      quantity: 2,
    });
    const lineId = lineStore[0]!.id;

    let cart = await service.updateLine({ id: lineId, quantity: 5 });
    expect(cart.lines[0]?.quantity).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartLineUpdated,
        data: expect.objectContaining({ lineId, quantity: 5 }),
      }),
    );

    cart = await service.removeLine(lineId);
    expect(cart.lines).toHaveLength(0);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartLineRemoved,
        data: expect.objectContaining({ lineId, cartId: 'cart-1' }),
      }),
    );
  });

  it('rejects inactive variants and missing carts', async () => {
    await service.create({});
    await expect(
      service.addLine({
        cartId: 'cart-1',
        variantId: 'var-2',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects edits on locked carts', async () => {
    await service.create({});
    await service.setStatus('cart-1', 'locked');
    await expect(
      service.addLine({
        cartId: 'cart-1',
        variantId: 'var-1',
        quantity: 1,
      }),
    ).rejects.toThrow(/locked/);
  });
});
