import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutService } from './checkout.service';
import type { CartService } from './cart.service';
import type { TaxEngine } from '../tax-engine/public';

describe('CheckoutService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let cartService: {
    getEntityWithLines: ReturnType<typeof vi.fn>;
    attachReservations: ReturnType<typeof vi.fn>;
    persistTaxResult: ReturnType<typeof vi.fn>;
    persistDiscountResult: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let inventory: {
    reserve: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let linesRepo: {
    save: ReturnType<typeof vi.fn>;
  };
  let tax: {
    calculateOrZero: ReturnType<typeof vi.fn>;
  };
  let promotions: {
    applyOrZero: ReturnType<typeof vi.fn>;
  };
  let service: CheckoutService;

  const baseCart = {
    id: 'cart-1',
    customerId: null,
    status: 'open',
    currencyCode: 'USD',
    shippingMethodCode: null,
    shippingRateCode: null,
    shippingMinor: '0',
    taxPricingMode: 'exclusive' as const,
    taxCountryCode: 'US',
    taxPostalCode: null,
    taxProvince: null,
    taxProviderCode: null,
    taxMinor: '0',
    couponCode: null,
    discountMinor: '0',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    cartService = {
      getEntityWithLines: vi.fn(async () => ({
        cart: { ...baseCart },
        lines: [
          {
            id: 'line-1',
            cartId: 'cart-1',
            variantId: 'var-1',
            quantity: 2,
            unitPriceMinor: '1000',
            reservationId: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'line-2',
            cartId: 'cart-1',
            variantId: 'var-2',
            quantity: 1,
            unitPriceMinor: '500',
            reservationId: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      })),
      attachReservations: vi.fn(async () => undefined),
      persistTaxResult: vi.fn(async () => undefined),
      persistDiscountResult: vi.fn(async () => undefined),
      setStatus: vi.fn(async () => undefined),
      findById: vi.fn(async () => ({
        ...baseCart,
        status: 'locked',
        taxMinor: '0',
        discountMinor: '0',
        lines: [],
      })),
    };

    inventory = {
      reserve: vi
        .fn()
        .mockResolvedValueOnce({ id: 'res-1' })
        .mockResolvedValueOnce({ id: 'res-2' }),
      release: vi.fn(async () => undefined),
    };

    linesRepo = {
      save: vi.fn(async (row: unknown) => row),
    };

    tax = {
      calculateOrZero: vi.fn(async (input: { pricingMode: string }) => ({
        currencyCode: 'USD',
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      })),
    };

    promotions = {
      applyOrZero: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      })),
    };

    service = new CheckoutService(
      cartService as unknown as CartService,
      inventory as never,
      linesRepo as never,
      tax as unknown as TaxEngine,
      promotions as never,
    );
  });

  it('reserves stock, calculates tax/promo (zero without provider), and locks cart', async () => {
    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2500');
    expect(preview.totals.discountMinor).toBe('0');
    expect(preview.totals.taxMinor).toBe('0');
    expect(preview.totals.shippingMinor).toBe('0');
    expect(preview.totals.totalMinor).toBe('2500');
    expect(preview.reservationIds).toEqual(['res-1', 'res-2']);
    expect(cartService.attachReservations).toHaveBeenCalledWith([
      { lineId: 'line-1', reservationId: 'res-1' },
      { lineId: 'line-2', reservationId: 'res-2' },
    ]);
    expect(cartService.persistTaxResult).toHaveBeenCalledWith('cart-1', '0');
    expect(cartService.persistDiscountResult).toHaveBeenCalledWith(
      'cart-1',
      '0',
    );
    expect(cartService.setStatus).toHaveBeenCalledWith('cart-1', 'locked');
    expect(inventory.reserve).toHaveBeenCalledTimes(2);
    expect(tax.calculateOrZero).toHaveBeenCalled();
    expect(promotions.applyOrZero).toHaveBeenCalled();
  });

  it('includes selected shippingMinor in prepareCheckout totals (B-03)', async () => {
    cartService.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        ...baseCart,
        shippingMethodCode: 'flat-rate',
        shippingRateCode: 'flat-rate',
        shippingMinor: '500',
      },
      lines: [
        {
          id: 'line-1',
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    inventory.reserve = vi.fn().mockResolvedValueOnce({ id: 'res-1' });

    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2000');
    expect(preview.totals.shippingMinor).toBe('500');
    expect(preview.totals.taxMinor).toBe('0');
    expect(preview.totals.totalMinor).toBe('2500');
  });

  it('adds exclusive tax on top of subtotal + shipping (C-03)', async () => {
    tax.calculateOrZero.mockResolvedValueOnce({
      currencyCode: 'USD',
      pricingMode: 'exclusive',
      taxMinor: '250',
      lines: [],
    });
    cartService.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        ...baseCart,
        taxPricingMode: 'exclusive',
        shippingMinor: '500',
      },
      lines: [
        {
          id: 'line-1',
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    inventory.reserve = vi.fn().mockResolvedValueOnce({ id: 'res-1' });

    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2000');
    expect(preview.totals.taxMinor).toBe('250');
    expect(preview.totals.shippingMinor).toBe('500');
    expect(preview.totals.totalMinor).toBe('2750');
    expect(cartService.persistTaxResult).toHaveBeenCalledWith('cart-1', '250');
  });

  it('subtracts promotion discount from prepareCheckout totals (D-01)', async () => {
    promotions.applyOrZero.mockResolvedValueOnce({
      currencyCode: 'USD',
      discountMinor: '300',
      applications: [
        { code: 'SAVE', kind: 'coupon', discountMinor: '300' },
      ],
      freeShipping: false,
    });
    cartService.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        ...baseCart,
        couponCode: 'SAVE',
        shippingMinor: '500',
      },
      lines: [
        {
          id: 'line-1',
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    inventory.reserve = vi.fn().mockResolvedValueOnce({ id: 'res-1' });

    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2000');
    expect(preview.totals.discountMinor).toBe('300');
    expect(preview.totals.shippingMinor).toBe('500');
    expect(preview.totals.totalMinor).toBe('2200');
    expect(cartService.persistDiscountResult).toHaveBeenCalledWith(
      'cart-1',
      '300',
    );
  });

  it('does not double-count inclusive tax in total (C-03)', async () => {
    tax.calculateOrZero.mockResolvedValueOnce({
      currencyCode: 'USD',
      pricingMode: 'inclusive',
      taxMinor: '181',
      lines: [],
    });
    cartService.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        ...baseCart,
        taxPricingMode: 'inclusive',
        shippingMinor: '500',
      },
      lines: [
        {
          id: 'line-1',
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    inventory.reserve = vi.fn().mockResolvedValueOnce({ id: 'res-1' });

    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2000');
    expect(preview.totals.taxMinor).toBe('181');
    expect(preview.totals.shippingMinor).toBe('500');
    // inclusive: total = subtotal + shipping (tax embedded)
    expect(preview.totals.totalMinor).toBe('2500');
  });

  it('rejects empty carts', async () => {
    cartService.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        id: 'cart-1',
        status: 'open',
        currencyCode: 'USD',
      },
      lines: [],
    });
    await expect(service.prepare('cart-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rolls back reservations when a later reserve fails', async () => {
    inventory.reserve = vi
      .fn()
      .mockResolvedValueOnce({ id: 'res-1' })
      .mockRejectedValueOnce(new ConflictException('Insufficient stock'));

    await expect(service.prepare('cart-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(inventory.release).toHaveBeenCalledWith('res-1');
    expect(cartService.setStatus).not.toHaveBeenCalled();
  });
});
