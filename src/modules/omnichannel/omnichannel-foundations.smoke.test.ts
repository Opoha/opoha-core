/**
 * Phase 7 A-04 — informal foundations gate smoke.
 * Core can represent digital fulfillment modes and non-web order sources
 * without importing `@opoha/plugin-*` (ADR-0003 / ADR-0010).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductsService } from '../catalog/products/products.service';
import type { ProductEntity } from '../catalog/entities/product.entity';
import type { ProductVariantEntity } from '../catalog/entities/product-variant.entity';
import { CoreEventName } from '../event-bus/event-catalog';
import { OrdersService } from '../order/orders.service';
import type { CartService } from '../order/cart.service';

describe('Omnichannel foundations smoke (A-04)', () => {
  describe('create product with fulfillment modes', () => {
    let products: Map<string, ProductEntity>;
    let variantsByProduct: Map<string, ProductVariantEntity[]>;
    let service: ProductsService;

    beforeEach(() => {
      products = new Map();
      variantsByProduct = new Map();
      const productRepo = {
        create: vi.fn(
          (data: Partial<ProductEntity>) => ({ ...data }) as ProductEntity,
        ),
        save: vi.fn(async (row: ProductEntity) => {
          if (!row.id) {
            row.id = `prod-${products.size + 1}`;
            row.createdAt = new Date('2026-08-04T00:00:00Z');
            row.updatedAt = row.createdAt;
          }
          products.set(row.id, { ...row, variants: row.variants ?? [] });
          return products.get(row.id)!;
        }),
        find: vi.fn(async () => [...products.values()]),
        findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = products.get(where.id);
          if (!row) return null;
          return {
            ...row,
            variants: variantsByProduct.get(where.id) ?? [],
          };
        }),
        delete: vi.fn(async () => ({ affected: 1 })),
      };
      const variantRepo = {
        create: vi.fn(
          (data: Partial<ProductVariantEntity>) =>
            ({ ...data }) as ProductVariantEntity,
        ),
        save: vi.fn(
          async (rows: ProductVariantEntity | ProductVariantEntity[]) => {
            const list = Array.isArray(rows) ? rows : [rows];
            for (const row of list) {
              if (!row.id) {
                row.id = `var-${Math.random().toString(36).slice(2, 8)}`;
                row.createdAt = new Date('2026-08-04T00:00:00Z');
                row.updatedAt = row.createdAt;
              }
              const bucket = variantsByProduct.get(row.productId) ?? [];
              bucket.push(row);
              variantsByProduct.set(row.productId, bucket);
            }
            return list;
          },
        ),
      };
      service = new ProductsService(productRepo as never, variantRepo as never);
    });

    it('creates digital + service SKUs on one product', async () => {
      const created = await service.create({
        name: 'Foundations Ebook',
        slug: 'foundations-ebook',
        fulfillmentMode: 'digital',
        variants: [
          { sku: 'A04-DIG', priceMinor: '999' },
          {
            sku: 'A04-SVC',
            priceMinor: '499',
            fulfillmentMode: 'service',
          },
        ],
      });

      expect(created.fulfillmentMode).toBe('digital');
      expect(created.variants?.[0]?.fulfillmentMode).toBe('digital');
      expect(created.variants?.[1]?.fulfillmentMode).toBe('service');
    });
  });

  describe('place order with orderSource', () => {
    const now = new Date('2026-08-04T12:00:00Z');
    const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const cartId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const lineId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const variantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const reservationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const paymentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    let eventBus: { publish: ReturnType<typeof vi.fn> };
    let service: OrdersService;
    let orderRow: Record<string, unknown>;

    beforeEach(() => {
      orderRow = {
        id: orderId,
        storeId: 'store-a',
        customerId: null,
        companyId: null,
        cartId,
        status: 'pending',
        orderSource: 'web',
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

      const carts = {
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

      eventBus = { publish: vi.fn(async () => ({ ok: true })) };

      const ordersRepo = {
        find: vi.fn(async () => [orderRow]),
        findOne: vi.fn(async () => ({ ...orderRow })),
        create: vi.fn((data: Record<string, unknown>) => ({
          ...data,
          id: orderId,
        })),
        save: vi.fn(async (row: Record<string, unknown>) => {
          orderRow = { ...orderRow, ...row, updatedAt: now };
          return { ...orderRow };
        }),
      };

      const linesRepo = {
        find: vi.fn(async () => [
          {
            id: 'ol-1',
            orderId,
            variantId,
            quantity: 2,
            unitPriceMinor: '1000',
            lineTotalMinor: '2000',
            createdAt: now,
          },
        ]),
        create: vi.fn((data: unknown) => data),
        save: vi.fn(async (rows: unknown) => rows),
      };

      const noop = {
        applyOrZero: vi.fn(async () => ({
          currencyCode: 'USD',
          discountMinor: '0',
          applications: [],
          freeShipping: false,
        })),
        quoteRedeem: vi.fn(async () => ({
          giftCardId: '',
          code: '',
          currencyCode: 'USD',
          availableMinor: '0',
          appliedMinor: '0',
          customerId: '',
          availablePoints: 0,
          pointsToRedeem: 0,
        })),
        redeem: vi.fn(async () => ({})),
        calculateOrZero: vi.fn(async (input: { pricingMode: string }) => ({
          currencyCode: 'USD',
          pricingMode: input.pricingMode,
          taxMinor: '0',
          lines: [],
        })),
        commit: vi.fn(async () => ({ id: reservationId, status: 'committed' })),
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
        findById: vi.fn(async (id: string) => ({ id, isActive: true })),
        findByCode: vi.fn(),
        assertCanBuy: vi.fn(async () => undefined),
        assertCanApprove: vi.fn(async () => undefined),
        assertWithinCreditLimit: vi.fn(async () => undefined),
        requireAcceptedForConvert: vi.fn(),
        markConverted: vi.fn(),
      };

      service = new OrdersService(
        ordersRepo as never,
        linesRepo as never,
        carts as unknown as CartService,
        { commit: noop.commit } as never,
        eventBus as never,
        {
          get: noop.get,
          authorize: noop.authorize,
          capture: noop.capture,
        } as never,
        { calculateOrZero: noop.calculateOrZero } as never,
        { applyOrZero: noop.applyOrZero } as never,
        {
          quoteRedeem: noop.quoteRedeem,
          redeem: noop.redeem,
        } as never,
        {
          quoteRedeem: noop.quoteRedeem,
          redeem: noop.redeem,
        } as never,
        { findById: noop.findById, findByCode: noop.findByCode } as never,
        {
          assertCanBuy: noop.assertCanBuy,
          assertCanApprove: noop.assertCanApprove,
          assertWithinCreditLimit: noop.assertWithinCreditLimit,
        } as never,
        {
          requireAcceptedForConvert: noop.requireAcceptedForConvert,
          markConverted: noop.markConverted,
        } as never,
      );
    });

    it('placeOrder records orderSource=pos and marketplace', async () => {
      const pos = await service.placeOrder({
        cartId,
        paymentMethod: 'manual',
        orderSource: 'pos',
      });
      expect(pos.orderSource).toBe('pos');

      const created = eventBus.publish.mock.calls.find(
        (call) => call[0].eventName === CoreEventName.OrderCreated,
      );
      expect(created?.[0].data.orderSource).toBe('pos');

      const posSale = eventBus.publish.mock.calls.find(
        (call) => call[0].eventName === CoreEventName.PosSaleCompleted,
      );
      expect(posSale?.[0].data).toMatchObject({
        orderId: pos.id,
        cartId,
        orderSource: 'pos',
      });

      eventBus.publish.mockClear();

      const marketplace = await service.placeOrder({
        cartId,
        paymentMethod: 'manual',
        orderSource: 'marketplace',
      });
      expect(marketplace.orderSource).toBe('marketplace');
      expect(
        eventBus.publish.mock.calls.some(
          (call) => call[0].eventName === CoreEventName.PosSaleCompleted,
        ),
      ).toBe(false);
    });
  });
});
