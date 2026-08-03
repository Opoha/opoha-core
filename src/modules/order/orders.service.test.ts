import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { OrdersService } from './orders.service';
import type { CartService } from './cart.service';

describe('OrdersService place + status (D-04 / D-05 / D-06 / A-04)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  const orderId = '11111111-1111-1111-1111-111111111111';
  const cartId = '22222222-2222-2222-2222-222222222222';
  const lineId = '33333333-3333-3333-3333-333333333333';
  const variantId = '44444444-4444-4444-4444-444444444444';
  const reservationId = '55555555-5555-5555-5555-555555555555';
  const paymentId = '66666666-6666-6666-6666-666666666666';

  let carts: {
    getEntityWithLines: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
  };
  let inventory: { commit: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let payments: {
    get: ReturnType<typeof vi.fn>;
    authorize: ReturnType<typeof vi.fn>;
    capture: ReturnType<typeof vi.fn>;
  };
  let tax: {
    calculateOrZero: ReturnType<typeof vi.fn>;
  };
  let ordersRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let linesRepo: {
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let service: OrdersService;
  let orderRow: {
    id: string;
    storeId: string;
    customerId: null | string;
    companyId: null | string;
    cartId: string | null;
    orderSource: string;
    vendorId: string | null;
    status: string;
    currencyCode: string;
    subtotalMinor: string;
    taxMinor: string;
    shippingMinor: string;
    discountMinor: string;
    couponCode: string | null;
    giftCardCode: string | null;
    giftCardMinor: string;
    loyaltyPointsRedeemed: number;
    loyaltyMinor: string;
    shippingMethodCode: string | null;
    shippingRateCode: string | null;
    totalMinor: string;
    createdAt: Date;
    updatedAt: Date;
  };
  let stores: {
    findById: ReturnType<typeof vi.fn>;
    findByCode: ReturnType<typeof vi.fn>;
  };
  let companies: {
    assertCanBuy: ReturnType<typeof vi.fn>;
    assertCanApprove: ReturnType<typeof vi.fn>;
    assertWithinCreditLimit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    orderRow = {
      id: orderId,
      storeId: 'store-a',
      customerId: null,
      companyId: null,
      cartId,
      orderSource: 'web',
      vendorId: null,
      status: 'pending',
      currencyCode: 'USD',
      subtotalMinor: '2000',
      taxMinor: '0',
      shippingMinor: '0',
      discountMinor: '0',
      couponCode: null,
      giftCardCode: null,
      giftCardMinor: '0',
      loyaltyPointsRedeemed: 0,
      loyaltyMinor: '0',
      shippingMethodCode: null,
      shippingRateCode: null,
      totalMinor: '2000',
      createdAt: now,
      updatedAt: now,
    };

    carts = {
      getEntityWithLines: vi.fn(async () => ({
        cart: {
          id: cartId,
          storeId: 'store-a',
          customerId: null,
          companyId: null,
          status: 'locked',
          currencyCode: 'USD',
          shippingMethodCode: null,
          shippingRateCode: null,
          shippingMinor: '0',
          taxPricingMode: 'exclusive',
          taxCountryCode: 'US',
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
        },
        lines: [
          {
            id: lineId,
            cartId,
            variantId,
            quantity: 2,
            unitPriceMinor: '1000',
            reservationId,
          },
        ],
      })),
      setStatus: vi.fn(async () => undefined),
    };

    inventory = {
      commit: vi.fn(async () => ({ id: reservationId, status: 'committed' })),
    };

    eventBus = {
      publish: vi.fn(async () => ({ ok: true })),
    };

    payments = {
      get: vi.fn(() => ({ code: 'manual', displayName: 'Manual' })),
      authorize: vi.fn(async () => ({
        id: paymentId,
        orderId,
        providerCode: 'manual',
        status: 'authorized',
        amountMinor: '2000',
        currencyCode: 'USD',
        errorMessage: null,
      })),
      capture: vi.fn(async () => ({
        id: paymentId,
        orderId,
        providerCode: 'manual',
        status: 'captured',
        amountMinor: '0',
        currencyCode: 'USD',
        errorMessage: null,
      })),
    };

    tax = {
      calculateOrZero: vi.fn(async (input: { pricingMode: string }) => ({
        currencyCode: 'USD',
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      })),
    };

    const promotions = {
      applyOrZero: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      })),
    };

    const giftCards = {
      quoteRedeem: vi.fn(async () => ({
        giftCardId: '',
        code: '',
        currencyCode: 'USD',
        availableMinor: '0',
        appliedMinor: '0',
      })),
      redeem: vi.fn(async () => ({
        id: 'gc-1',
        code: 'GC-1',
        currencyCode: 'USD',
        initialBalanceMinor: '0',
        balanceMinor: '0',
        status: 'depleted',
        customerId: null,
        purchasedOrderId: null,
        expiresAt: null,
        issuedAt: now,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      })),
    };

    const loyalty = {
      quoteRedeem: vi.fn(async () => ({
        customerId: '',
        availablePoints: 0,
        pointsToRedeem: 0,
        appliedMinor: '0',
      })),
      redeem: vi.fn(async () => ({
        id: 'la-1',
        customerId: '',
        pointsBalance: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
        createdAt: now,
        updatedAt: now,
      })),
    };

    ordersRepo = {
      find: vi.fn(async () => [orderRow]),
      findOne: vi.fn(async () => ({ ...orderRow })),
      create: vi.fn((data: typeof orderRow) => ({ ...data, id: orderId })),
      save: vi.fn(async (row: typeof orderRow) => {
        orderRow = { ...orderRow, ...row, updatedAt: now };
        return { ...orderRow };
      }),
    };

    linesRepo = {
      find: vi.fn(async () => [
        {
          id: 'ol-1',
          orderId,
          variantId,
          vendorId: null,
          quantity: 2,
          unitPriceMinor: '1000',
          lineTotalMinor: '2000',
          createdAt: now,
        },
      ]),
      create: vi.fn((data: unknown) => data),
      save: vi.fn(async (rows: Array<Record<string, unknown>>) =>
        rows.map((row, i) => ({
          id: `ol-${i + 1}`,
          createdAt: now,
          vendorId: null,
          ...row,
        })),
      ),
    };

    stores = {
      findById: vi.fn(async (id: string) => ({ id, isActive: true })),
      findByCode: vi.fn(),
    };

    companies = {
      assertCanBuy: vi.fn(async () => undefined),
      assertCanApprove: vi.fn(async () => undefined),
      assertWithinCreditLimit: vi.fn(async () => undefined),
    };

    const quotes = {
      requireAcceptedForConvert: vi.fn(async () => ({
        quote: {
          id: 'quote-1',
          companyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          storeId: 'store-a',
          customerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          poNumber: 'PO-100',
          status: 'accepted',
          currencyCode: 'USD',
          notes: null,
          orderId: null,
        },
        lines: [
          {
            id: 'ql-1',
            quoteId: 'quote-1',
            variantId,
            quantity: 2,
            unitPriceMinor: '1000',
          },
        ],
        subtotalMinor: '2000',
      })),
      markConverted: vi.fn(async () => ({
        id: 'quote-1',
        status: 'converted',
        orderId,
      })),
    };

    service = new OrdersService(
      ordersRepo as never,
      linesRepo as never,
      {
        find: vi.fn(async () => [
          { id: variantId, productId: 'prod-1' },
        ]),
      } as never,
      {
        find: vi.fn(async () => [{ id: 'prod-1', vendorId: null }]),
      } as never,
      carts as unknown as CartService,
      inventory as never,
      eventBus as never,
      payments as never,
      tax as never,
      promotions as never,
      giftCards as never,
      loyalty as never,
      stores as never,
      companies as never,
      quotes as never,
    );
  });

  it('happy path: locked cart → placeOrder (manual) → PaymentEngine authorize → confirmed', async () => {
    const order = await service.placeOrder({
      cartId,
      paymentMethod: 'manual',
    });

    expect(order.status).toBe('confirmed');
    expect(order.storeId).toBe('store-a');
    expect(order.orderSource).toBe('web');
    expect(order.totalMinor).toBe('2000');
    expect(payments.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: 'manual',
        orderId,
        amount: { amountMinor: '2000', currencyCode: 'USD' },
        idempotencyKey: `place-order:${orderId}`,
      }),
    );
    expect(payments.capture).not.toHaveBeenCalled();
    expect(inventory.commit).toHaveBeenCalledWith(reservationId);
    expect(carts.setStatus).toHaveBeenCalledWith(cartId, 'converted');

    const eventNames = eventBus.publish.mock.calls.map(
      (call) => call[0].eventName,
    );
    expect(eventNames).toContain(CoreEventName.OrderCreated);
    expect(eventNames).toContain(CoreEventName.OrderTimeline);
    expect(eventNames).toContain(CoreEventName.OrderStatusChanged);

    const timelineTypes = eventBus.publish.mock.calls
      .filter((call) => call[0].eventName === CoreEventName.OrderTimeline)
      .map((call) => call[0].data.type);
    expect(timelineTypes).toEqual(
      expect.arrayContaining(['created', 'payment_recorded', 'status_changed']),
    );
  });

  it('placeOrder records orderSource=pos and publishes PosSaleCompleted (A-03/B-02)', async () => {
    const order = await service.placeOrder({
      cartId,
      paymentMethod: 'manual',
      orderSource: 'pos',
    });
    expect(order.orderSource).toBe('pos');
    expect(inventory.commit).toHaveBeenCalledWith(reservationId);
    const created = eventBus.publish.mock.calls.find(
      (call) => call[0].eventName === CoreEventName.OrderCreated,
    );
    expect(created?.[0].data.orderSource).toBe('pos');
    const posSale = eventBus.publish.mock.calls.find(
      (call) => call[0].eventName === CoreEventName.PosSaleCompleted,
    );
    expect(posSale?.[0].data).toMatchObject({
      orderId: order.id,
      cartId,
      orderSource: 'pos',
      storeId: 'store-a',
    });
  });

  it('placeOrder stamps vendorId and publishes VendorOrderRouted (C-02/C-04)', async () => {
    const vendorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const products = {
      find: vi.fn(async () => [{ id: 'prod-1', vendorId }]),
    };
    // Rebuild with vendor-scoped catalog; reuse sibling deps from beforeEach via placeOrder path.
    const promotions = {
      applyOrZero: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      })),
    };
    const giftCards = {
      quoteRedeem: vi.fn(async () => ({
        giftCardId: '',
        code: '',
        currencyCode: 'USD',
        availableMinor: '0',
        appliedMinor: '0',
      })),
      redeem: vi.fn(async () => ({
        id: 'gc-1',
        code: 'GC-1',
        currencyCode: 'USD',
        initialBalanceMinor: '0',
        balanceMinor: '0',
        status: 'depleted',
        customerId: null,
        purchasedOrderId: null,
        expiresAt: null,
        issuedAt: now,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      })),
    };
    const loyalty = {
      quoteRedeem: vi.fn(async () => ({
        customerId: '',
        availablePoints: 0,
        pointsToRedeem: 0,
        appliedMinor: '0',
      })),
      redeem: vi.fn(async () => ({
        id: 'la-1',
        customerId: '',
        pointsBalance: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
        createdAt: now,
        updatedAt: now,
      })),
    };
    const quotes = {
      requireAcceptedForConvert: vi.fn(),
      markConverted: vi.fn(),
    };

    linesRepo.save.mockImplementation(
      async (rows: Array<Record<string, unknown>>) =>
        rows.map((row, i) => ({
          id: `ol-${i + 1}`,
          createdAt: now,
          ...row,
        })),
    );

    service = new OrdersService(
      ordersRepo as never,
      linesRepo as never,
      {
        find: vi.fn(async () => [{ id: variantId, productId: 'prod-1' }]),
      } as never,
      products as never,
      carts as unknown as CartService,
      inventory as never,
      eventBus as never,
      payments as never,
      tax as never,
      promotions as never,
      giftCards as never,
      loyalty as never,
      stores as never,
      companies as never,
      quotes as never,
    );

    const order = await service.placeOrder({
      cartId,
      paymentMethod: 'manual',
      orderSource: 'marketplace',
    });

    expect(order.orderSource).toBe('marketplace');
    expect(order.vendorId).toBe(vendorId);
    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderSource: 'marketplace',
        vendorId,
      }),
    );
    expect(linesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId,
        variantId,
      }),
    );

    const routed = eventBus.publish.mock.calls.find(
      (call) => call[0].eventName === CoreEventName.VendorOrderRouted,
    );
    expect(routed?.[0].data).toMatchObject({
      orderId: order.id,
      vendorId,
      orderSource: 'marketplace',
      lineCount: 1,
    });
    expect(routed?.[0].data.lineIds).toEqual(['ol-1']);
  });

  it('rejects invalid orderSource', async () => {
    await expect(
      service.placeOrder({
        cartId,
        paymentMethod: 'manual',
        orderSource: 'mobile',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('zero payment rejects non-zero totals', async () => {
    await expect(
      service.placeOrder({ cartId, paymentMethod: 'zero' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(payments.authorize).not.toHaveBeenCalled();
  });

  it('zero payment authorizes + captures via manual provider', async () => {
    carts.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        id: cartId,
        storeId: 'store-a',
        customerId: null,
        status: 'locked',
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
        taxPricingMode: 'exclusive',
        taxCountryCode: 'US',
        taxPostalCode: null,
        taxProvince: null,
        taxProviderCode: null,
        taxMinor: '0',
      },
      lines: [
        {
          id: lineId,
          cartId,
          variantId,
          quantity: 1,
          unitPriceMinor: '0',
          reservationId,
        },
      ],
    });
    ordersRepo.create.mockImplementation((data: typeof orderRow) => ({
      ...data,
      id: orderId,
      totalMinor: '0',
      subtotalMinor: '0',
    }));
    orderRow.totalMinor = '0';
    orderRow.subtotalMinor = '0';
    payments.authorize.mockResolvedValueOnce({
      id: paymentId,
      orderId,
      providerCode: 'manual',
      status: 'authorized',
      amountMinor: '0',
      currencyCode: 'USD',
      errorMessage: null,
    });

    const order = await service.placeOrder({
      cartId,
      paymentMethod: 'zero',
    });
    expect(order.status).toBe('confirmed');
    expect(payments.authorize).toHaveBeenCalled();
    expect(payments.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId,
        idempotencyKey: `place-order-capture:${orderId}`,
      }),
    );
  });

  it('copies selected shipping method from cart onto order (B-02)', async () => {
    carts.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        id: cartId,
        storeId: 'store-a',
        customerId: null,
        status: 'locked',
        currencyCode: 'USD',
        shippingMethodCode: 'flat-rate',
        shippingRateCode: 'flat-rate',
        shippingMinor: '500',
        taxPricingMode: 'exclusive',
        taxCountryCode: 'US',
        taxPostalCode: null,
        taxProvince: null,
        taxProviderCode: null,
        taxMinor: '0',
      },
      lines: [
        {
          id: lineId,
          cartId,
          variantId,
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId,
        },
      ],
    });
    payments.authorize.mockResolvedValueOnce({
      id: paymentId,
      orderId,
      providerCode: 'manual',
      status: 'authorized',
      amountMinor: '2500',
      currencyCode: 'USD',
      errorMessage: null,
    });

    const order = await service.placeOrder({
      cartId,
      paymentMethod: 'manual',
    });

    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingMinor: '500',
        shippingMethodCode: 'flat-rate',
        shippingRateCode: 'flat-rate',
        totalMinor: '2500',
      }),
    );
    expect(payments.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { amountMinor: '2500', currencyCode: 'USD' },
      }),
    );
    expect(order.shippingMinor).toBe('500');
    expect(order.shippingMethodCode).toBe('flat-rate');
    expect(order.shippingRateCode).toBe('flat-rate');
  });

  it('placeOrder adds exclusive tax to authorize amount (C-03)', async () => {
    tax.calculateOrZero.mockResolvedValueOnce({
      currencyCode: 'USD',
      pricingMode: 'exclusive',
      taxMinor: '200',
      lines: [],
    });
    payments.authorize.mockResolvedValueOnce({
      id: paymentId,
      orderId,
      providerCode: 'manual',
      status: 'authorized',
      amountMinor: '2200',
      currencyCode: 'USD',
      errorMessage: null,
    });

    await service.placeOrder({ cartId, paymentMethod: 'manual' });

    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalMinor: '2000',
        taxMinor: '200',
        totalMinor: '2200',
      }),
    );
    expect(payments.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { amountMinor: '2200', currencyCode: 'USD' },
      }),
    );
  });

  it('placeOrder inclusive tax does not inflate authorize amount (C-03)', async () => {
    carts.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        id: cartId,
        storeId: 'store-a',
        customerId: null,
        status: 'locked',
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
        taxPricingMode: 'inclusive',
        taxCountryCode: 'US',
        taxPostalCode: null,
        taxProvince: null,
        taxProviderCode: null,
        taxMinor: '0',
      },
      lines: [
        {
          id: lineId,
          cartId,
          variantId,
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId,
        },
      ],
    });
    tax.calculateOrZero.mockResolvedValueOnce({
      currencyCode: 'USD',
      pricingMode: 'inclusive',
      taxMinor: '181',
      lines: [],
    });

    await service.placeOrder({ cartId, paymentMethod: 'manual' });

    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalMinor: '2000',
        taxMinor: '181',
        totalMinor: '2000',
      }),
    );
    expect(payments.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { amountMinor: '2000', currencyCode: 'USD' },
      }),
    );
  });

  it('rejects when payment provider is not registered', async () => {
    payments.get.mockReturnValueOnce(undefined);
    await expect(
      service.placeOrder({ cartId, paymentMethod: 'manual' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(payments.authorize).not.toHaveBeenCalled();
    expect(inventory.commit).not.toHaveBeenCalled();
  });

  it('cancels order when authorization fails', async () => {
    payments.authorize.mockResolvedValueOnce({
      id: paymentId,
      orderId,
      providerCode: 'manual',
      status: 'failed',
      amountMinor: '2000',
      currencyCode: 'USD',
      errorMessage: 'declined',
    });

    await expect(
      service.placeOrder({ cartId, paymentMethod: 'manual' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(orderRow.status).toBe('cancelled');
  });

  it('rejects placeOrder when cart is not locked', async () => {
    carts.getEntityWithLines.mockResolvedValueOnce({
      cart: {
        id: cartId,
        storeId: 'store-a',
        status: 'open',
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
        taxPricingMode: 'exclusive',
        taxCountryCode: null,
        taxPostalCode: null,
        taxProvince: null,
        taxProviderCode: null,
        taxMinor: '0',
      },
      lines: [
        {
          id: lineId,
          reservationId,
          quantity: 1,
          unitPriceMinor: '100',
          variantId,
        },
      ],
    });
    await expect(
      service.placeOrder({ cartId, paymentMethod: 'manual' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateStatus fulfilled after confirmed', async () => {
    orderRow.status = 'confirmed';
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    const order = await service.updateStatus({
      id: orderId,
      status: 'fulfilled',
    });
    expect(order.status).toBe('fulfilled');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.OrderStatusChanged,
        data: expect.objectContaining({
          fromStatus: 'confirmed',
          toStatus: 'fulfilled',
        }),
      }),
    );
  });

  it('denies invalid status transition', async () => {
    orderRow.status = 'fulfilled';
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    await expect(
      service.updateStatus({ id: orderId, status: 'pending' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateStatus publishes OrderCancelled when cancelling', async () => {
    orderRow.status = 'pending';
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    await service.updateStatus({ id: orderId, status: 'cancelled' });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.OrderCancelled,
        data: expect.objectContaining({
          orderId,
          fromStatus: 'pending',
        }),
      }),
    );
  });

  it('findById throws when missing', async () => {
    ordersRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('B2B placeOrder creates draft without payment (F-03)', async () => {
    const companyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const customerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    carts.getEntityWithLines.mockResolvedValue({
      cart: {
        id: cartId,
        storeId: 'store-a',
        customerId,
        companyId,
        status: 'locked',
        currencyCode: 'USD',
        shippingMethodCode: null,
        shippingRateCode: null,
        shippingMinor: '0',
        taxPricingMode: 'exclusive',
        taxCountryCode: 'US',
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
      },
      lines: [
        {
          id: lineId,
          cartId,
          variantId,
          quantity: 2,
          unitPriceMinor: '1000',
          reservationId,
        },
      ],
    });
    ordersRepo.create.mockImplementation((data: typeof orderRow) => ({
      ...data,
      id: orderId,
    }));
    ordersRepo.save.mockImplementation(async (row: typeof orderRow) => {
      orderRow = { ...orderRow, ...row, updatedAt: now };
      return { ...orderRow };
    });

    const order = await service.placeOrder({ cartId, paymentMethod: 'manual' });

    expect(order.status).toBe('draft');
    expect(order.companyId).toBe(companyId);
    expect(companies.assertCanBuy).toHaveBeenCalledWith(companyId, customerId);
    expect(companies.assertWithinCreditLimit).toHaveBeenCalledWith(
      companyId,
      '2000',
    );
    expect(payments.authorize).not.toHaveBeenCalled();
    expect(inventory.commit).toHaveBeenCalledWith(reservationId);
    expect(carts.setStatus).toHaveBeenCalledWith(cartId, 'converted');
  });

  it('B2B approve then confirm reaches confirmed (F-03)', async () => {
    const companyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const approverId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    orderRow.status = 'draft';
    orderRow.companyId = companyId;
    orderRow.customerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    const approved = await service.approveB2bOrder({
      orderId,
      approverCustomerId: approverId,
    });
    expect(approved.status).toBe('approved');
    expect(companies.assertCanApprove).toHaveBeenCalledWith(
      companyId,
      approverId,
    );

    orderRow.status = 'approved';
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    const confirmed = await service.confirmB2bOrder({
      orderId,
      paymentMethod: 'manual',
    });
    expect(confirmed.status).toBe('confirmed');
    expect(payments.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `confirm-b2b-order:${orderId}`,
      }),
    );
  });

  it('convertB2bQuote creates draft order from accepted quote (F-05)', async () => {
    const companyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const customerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    orderRow = {
      ...orderRow,
      storeId: 'store-a',
      customerId,
      companyId,
      cartId: null,
      status: 'draft',
      subtotalMinor: '2000',
      totalMinor: '2000',
    };
    ordersRepo.findOne.mockResolvedValue({ ...orderRow });

    const order = await service.convertB2bQuote({ quoteId: 'quote-1' });
    expect(order.status).toBe('draft');
    expect(order.companyId).toBe(companyId);
    expect(order.totalMinor).toBe('2000');
    expect(companies.assertCanBuy).toHaveBeenCalledWith(companyId, customerId);
    expect(companies.assertWithinCreditLimit).toHaveBeenCalledWith(
      companyId,
      '2000',
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.OrderCreated,
        data: expect.objectContaining({
          paymentMethod: 'b2b_quote',
          cartId: null,
        }),
      }),
    );
  });
});
