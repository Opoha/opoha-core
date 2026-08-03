import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { CartService } from './cart.service';

type CartRow = {
  id: string;
  customerId: string | null;
  status: 'open' | 'locked' | 'converted' | 'abandoned';
  currencyCode: string;
  shippingMethodCode: string | null;
  shippingRateCode: string | null;
  shippingMinor: string;
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

  beforeEach(() => {
    cartStore = [];
    lineStore = [];
    variantStore = [
      { id: 'var-1', priceMinor: '1999', isActive: true },
      { id: 'var-2', priceMinor: '500', isActive: false },
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
        customerId: null,
        status: 'open' as const,
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
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
      update: vi.fn(
        async (
          where: { id: string },
          patch: Partial<CartRow>,
        ) => {
          const row = cartStore.find((r) => r.id === where.id);
          if (row) Object.assign(row, patch);
        },
      ),
    };

    linesRepo = {
      find: vi.fn(
        async ({
          where,
        }: {
          where: Partial<LineRow>;
          order?: unknown;
        }) => lineStore.filter((r) => r.cartId === where.cartId),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<LineRow> }) => {
        if (where.id) {
          return lineStore.find((r) => r.id === where.id) ?? null;
        }
        return (
          lineStore.find(
            (r) =>
              r.cartId === where.cartId && r.variantId === where.variantId,
          ) ?? null
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
      update: vi.fn(
        async (
          where: { id: string },
          patch: Partial<LineRow>,
        ) => {
          const row = lineStore.find((r) => r.id === where.id);
          if (row) Object.assign(row, patch);
        },
      ),
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

    service = new CartService(
      cartsRepo as never,
      linesRepo as never,
      variantsRepo as never,
      eventBus as never,
      shipping as never,
    );
  });

  it('creates a cart and publishes CartCreated', async () => {
    const cart = await service.create({});
    expect(cart.id).toBe('cart-1');
    expect(cart.status).toBe('open');
    expect(cart.shippingMinor).toBe('0');
    expect(cart.lines).toEqual([]);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CartCreated,
        aggregateId: 'cart-1',
      }),
    );
  });

  it('selectShipping persists method/rate from ShippingEngine (B-02)', async () => {
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

    cart = await service.addLine({
      cartId: 'cart-1',
      variantId: 'var-1',
      quantity: 1,
    });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe(3);
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

    cart = await service.removeLine(lineId);
    expect(cart.lines).toHaveLength(0);
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

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
