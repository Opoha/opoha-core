import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutService } from './checkout.service';
import type { CartService } from './cart.service';

describe('CheckoutService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let cartService: {
    getEntityWithLines: ReturnType<typeof vi.fn>;
    attachReservations: ReturnType<typeof vi.fn>;
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
  let service: CheckoutService;

  beforeEach(() => {
    cartService = {
      getEntityWithLines: vi.fn(async () => ({
        cart: {
          id: 'cart-1',
          customerId: null,
          status: 'open',
          currencyCode: 'USD',
          createdAt: now,
          updatedAt: now,
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
      setStatus: vi.fn(async () => undefined),
      findById: vi.fn(async () => ({
        id: 'cart-1',
        customerId: null,
        status: 'locked',
        currencyCode: 'USD',
        lines: [],
        createdAt: now,
        updatedAt: now,
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

    service = new CheckoutService(
      cartService as unknown as CartService,
      inventory as never,
      linesRepo as never,
    );
  });

  it('reserves stock, stubs tax/shipping at zero, and locks cart', async () => {
    const preview = await service.prepare('cart-1');

    expect(preview.totals.subtotalMinor).toBe('2500');
    expect(preview.totals.taxMinor).toBe('0');
    expect(preview.totals.shippingMinor).toBe('0');
    expect(preview.totals.totalMinor).toBe('2500');
    expect(preview.reservationIds).toEqual(['res-1', 'res-2']);
    expect(cartService.attachReservations).toHaveBeenCalledWith([
      { lineId: 'line-1', reservationId: 'res-1' },
      { lineId: 'line-2', reservationId: 'res-2' },
    ]);
    expect(cartService.setStatus).toHaveBeenCalledWith('cart-1', 'locked');
    expect(inventory.reserve).toHaveBeenCalledTimes(2);
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
