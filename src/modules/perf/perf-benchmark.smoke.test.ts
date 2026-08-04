/**
 * Runnable performance harness (local/CI; no cloud).
 * Scenarios + SLOs: workspace docs/readiness/performance-benchmarks.md
 */
import { describe, expect, it, vi } from 'vitest';

import { ProductsService } from '../catalog/products/products.service';
import type { ProductEntity } from '../catalog/entities/product.entity';
import type { ProductVariantEntity } from '../catalog/entities/product-variant.entity';
import { CartService } from '../order/cart.service';
import { CheckoutService } from '../order/checkout.service';
import { OrdersService } from '../order/orders.service';
import type { CartService as CartServiceType } from '../order/cart.service';
import type { TaxEngine } from '../tax-engine/public';
import {
  PERF_SLO_P95_MS,
  evaluateScenario,
  formatScenarioLine,
  measureAsync,
  type ScenarioResult,
} from './perf-timing';

const WARMUP = Number(process.env.PERF_BENCH_WARMUP ?? 5);
const ITERS = Number(process.env.PERF_BENCH_ITERS ?? 25);

function buildProductsService(productCount: number): ProductsService {
  const products = new Map<string, ProductEntity>();
  const variantsByProduct = new Map<string, ProductVariantEntity[]>();
  const now = new Date('2026-08-04T00:00:00Z');

  for (let i = 0; i < productCount; i++) {
    const id = `prod-${i}`;
    const variantId = `var-${i}`;
    products.set(id, {
      id,
      name: `Product ${i}`,
      slug: `product-${i}`,
      description: null,
      isActive: true,
      storeId: null,
      vendorId: null,
      fulfillmentMode: 'physical',
      createdAt: now,
      updatedAt: now,
    } as ProductEntity);
    variantsByProduct.set(id, [
      {
        id: variantId,
        productId: id,
        sku: `SKU-${i}`,
        name: 'Default',
        priceMinor: '1999',
        isActive: true,
        fulfillmentMode: 'physical',
        createdAt: now,
        updatedAt: now,
      } as ProductVariantEntity,
    ]);
  }

  const productRepo = {
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    find: vi.fn(async () =>
      [...products.values()].map((row) => ({
        ...row,
        variants: variantsByProduct.get(row.id) ?? [],
      })),
    ),
    findOne: vi.fn(),
  };

  const variantRepo = {
    create: vi.fn(),
    save: vi.fn(),
  };

  return new ProductsService(productRepo as never, variantRepo as never);
}

function buildCartService(): CartService {
  const now = new Date('2026-08-04T12:00:00Z');
  const cartStore: Array<Record<string, unknown>> = [];
  const lineStore: Array<Record<string, unknown>> = [];
  let cartSeq = 0;
  let lineSeq = 0;

  const cartsRepo = {
    find: vi.fn(async () => [...cartStore]),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
      return cartStore.find((r) => r.id === where.id) ?? null;
    }),
    create: vi.fn((data: Record<string, unknown>) => ({
      id: `cart-${++cartSeq}`,
      storeId: 'store-default',
      customerId: null,
      companyId: null,
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
    save: vi.fn(async (row: Record<string, unknown>) => {
      const idx = cartStore.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        cartStore[idx] = { ...row };
        return cartStore[idx];
      }
      cartStore.push({ ...row });
      return row;
    }),
    update: vi.fn(async (where: { id: string }, patch: Record<string, unknown>) => {
      const row = cartStore.find((r) => r.id === where.id);
      if (row) Object.assign(row, patch);
    }),
  };

  const linesRepo = {
    find: vi.fn(async ({ where }: { where: { cartId: string } }) =>
      lineStore.filter((r) => r.cartId === where.cartId),
    ),
    findOne: vi.fn(
      async ({ where }: { where: { id?: string; cartId?: string; variantId?: string } }) => {
        if (where.id) {
          return lineStore.find((r) => r.id === where.id) ?? null;
        }
        return (
          lineStore.find((r) => r.cartId === where.cartId && r.variantId === where.variantId) ??
          null
        );
      },
    ),
    create: vi.fn((data: Record<string, unknown>) => ({
      id: `line-${++lineSeq}`,
      reservationId: null,
      createdAt: now,
      updatedAt: now,
      ...data,
    })),
    save: vi.fn(async (row: Record<string, unknown>) => {
      const idx = lineStore.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        lineStore[idx] = { ...row };
        return lineStore[idx];
      }
      lineStore.push({ ...row });
      return row;
    }),
    delete: vi.fn(),
    update: vi.fn(),
  };

  const variantsRepo = {
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id !== 'var-1') return null;
      return {
        id: 'var-1',
        priceMinor: '1999',
        isActive: true,
        product: { storeId: null },
      };
    }),
  };

  return new CartService(
    cartsRepo as never,
    linesRepo as never,
    variantsRepo as never,
    { publish: vi.fn(async () => undefined) } as never,
    {
      findQuotedRate: vi.fn(async () => ({
        methodCode: 'flat-rate',
        methodDisplayName: 'Flat rate',
        code: 'flat-rate',
        displayName: 'Flat rate',
        amount: { amountMinor: '500', currencyCode: 'USD' },
      })),
    } as never,
    {
      findById: vi.fn(async (id: string) => ({ id, isActive: true })),
      findByCode: vi.fn(async () => ({ id: 'store-from-code', isActive: true })),
      findDefault: vi.fn(async () => ({
        id: 'store-default',
        isActive: true,
      })),
    } as never,
    {
      getForStore: vi.fn(async () => ({
        storeId: 'store-default',
        settlementCurrencyCode: 'USD',
        displayCurrencyCode: 'USD',
        enabledDisplayCurrencies: ['USD'],
        createdAt: now,
        updatedAt: now,
      })),
    } as never,
    {
      convertTotals: vi.fn(async (_storeId, totals) => ({
        ...totals,
        settlementCurrencyCode: totals.currencyCode,
        displayCurrencyCode: totals.currencyCode,
        rate: 1,
        roundingMode: 'half_up',
      })),
    } as never,
    {
      resolveUnitPriceMinor: vi.fn(
        async (_companyId: string | null, _variantId: string, catalog: string) => catalog,
      ),
    } as never,
  );
}

function buildCheckoutService(): CheckoutService {
  const now = new Date('2026-08-04T12:00:00Z');
  const baseCart = {
    id: 'cart-1',
    storeId: 'store-a',
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
    giftCardCode: null,
    giftCardMinor: '0',
    loyaltyPointsToRedeem: 0,
    loyaltyMinor: '0',
    createdAt: now,
    updatedAt: now,
  };

  const cartService = {
    getEntityWithLines: vi.fn(async () => ({
      cart: { ...baseCart, status: 'open' },
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
    applyCompanyPriceList: vi.fn(async () => undefined),
    attachReservations: vi.fn(async () => undefined),
    persistTaxResult: vi.fn(async () => undefined),
    persistDiscountResult: vi.fn(async () => undefined),
    persistGiftCardResult: vi.fn(async () => undefined),
    persistLoyaltyResult: vi.fn(async () => undefined),
    setStatus: vi.fn(async () => undefined),
    findById: vi.fn(async () => ({
      ...baseCart,
      status: 'locked',
      lines: [],
    })),
  };

  let resSeq = 0;
  return new CheckoutService(
    cartService as unknown as CartServiceType,
    {
      reserveForStore: vi.fn(async () => ({ id: `res-${++resSeq}` })),
      release: vi.fn(async () => undefined),
    } as never,
    { save: vi.fn(async (row: unknown) => row) } as never,
    {
      find: vi.fn(async () => [
        { id: 'var-1', fulfillmentMode: 'physical' },
        { id: 'var-2', fulfillmentMode: 'physical' },
      ]),
    } as never,
    {
      calculateOrZero: vi.fn(async (input: { pricingMode: string }) => ({
        currencyCode: 'USD',
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      })),
    } as unknown as TaxEngine,
    {
      applyOrZero: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      })),
    } as never,
    {
      quoteRedeem: vi.fn(async () => ({
        giftCardId: '',
        code: '',
        currencyCode: 'USD',
        availableMinor: '0',
        appliedMinor: '0',
      })),
    } as never,
    {
      quoteRedeem: vi.fn(async () => ({
        customerId: '',
        availablePoints: 0,
        pointsToRedeem: 0,
        appliedMinor: '0',
      })),
    } as never,
    { publish: vi.fn(async () => undefined) } as never,
    {
      findById: vi.fn(async (id: string) => ({ id, isActive: true })),
      findByCode: vi.fn(),
    } as never,
    {
      convertTotals: vi.fn(async (_storeId, totals) => ({
        ...totals,
        settlementCurrencyCode: totals.currencyCode,
        displayCurrencyCode: totals.currencyCode,
        rate: 1,
        roundingMode: 'half_up',
      })),
    } as never,
  );
}

function buildOrdersService(): OrdersService {
  const now = new Date('2026-08-04T12:00:00Z');
  const cartId = '22222222-2222-2222-2222-222222222222';
  const lineId = '33333333-3333-3333-3333-333333333333';
  const variantId = '44444444-4444-4444-4444-444444444444';
  const reservationId = '55555555-5555-5555-5555-555555555555';
  const paymentId = '66666666-6666-6666-6666-666666666666';
  let orderSeq = 0;

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

  const ordersRepo = {
    find: vi.fn(async () => []),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      storeId: 'store-a',
      customerId: null,
      companyId: null,
      cartId,
      orderSource: 'web',
      vendorId: null,
      status: 'confirmed',
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
    })),
    create: vi.fn((data: Record<string, unknown>) => ({
      ...data,
      id: `order-${++orderSeq}`,
    })),
    save: vi.fn(async (row: Record<string, unknown>) => ({
      ...row,
      updatedAt: now,
    })),
  };

  const linesRepo = {
    find: vi.fn(async ({ where }: { where: { orderId: string } }) => [
      {
        id: 'ol-1',
        orderId: where.orderId,
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

  return new OrdersService(
    ordersRepo as never,
    linesRepo as never,
    {
      find: vi.fn(async () => [
        { id: variantId, productId: 'prod-1', fulfillmentMode: 'physical' },
      ]),
    } as never,
    {
      find: vi.fn(async () => [{ id: 'prod-1', vendorId: null }]),
    } as never,
    carts as unknown as CartServiceType,
    {
      commit: vi.fn(async () => ({ id: reservationId, status: 'committed' })),
    } as never,
    { publish: vi.fn(async () => ({ ok: true })) } as never,
    {
      get: vi.fn(() => ({ code: 'manual', displayName: 'Manual' })),
      authorize: vi.fn(async () => ({
        id: paymentId,
        orderId: 'order-x',
        providerCode: 'manual',
        status: 'authorized',
        amountMinor: '2000',
        currencyCode: 'USD',
        errorMessage: null,
      })),
      capture: vi.fn(async () => ({
        id: paymentId,
        orderId: 'order-x',
        providerCode: 'manual',
        status: 'captured',
        amountMinor: '0',
        currencyCode: 'USD',
        errorMessage: null,
      })),
    } as never,
    {
      calculateOrZero: vi.fn(async (input: { pricingMode: string }) => ({
        currencyCode: 'USD',
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      })),
    } as never,
    {
      applyOrZero: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      })),
    } as never,
    {
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
    } as never,
    {
      issueForOrder: vi.fn(async () => ({
        orderId: 'order-x',
        downloadTokens: [],
        licenseKeys: [],
      })),
    } as never,
    {
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
    } as never,
    {
      findById: vi.fn(async (id: string) => ({ id, isActive: true })),
      findByCode: vi.fn(),
    } as never,
    {
      assertCanBuy: vi.fn(async () => undefined),
      assertCanApprove: vi.fn(async () => undefined),
      assertWithinCreditLimit: vi.fn(async () => undefined),
    } as never,
    {
      requireAcceptedForConvert: vi.fn(),
      markConverted: vi.fn(),
    } as never,
  );
}

describe('Performance benchmark harness', () => {
  it('runs catalog/cart/checkout/orders scenarios under SLO ceilings', async () => {
    const results: ScenarioResult[] = [];

    // PERF-CATALOG-LIST
    {
      const products = buildProductsService(100);
      const stats = await measureAsync(
        async () => {
          const rows = await products.findAll();
          expect(rows).toHaveLength(100);
        },
        { warmup: WARMUP, iterations: ITERS },
      );
      results.push(
        evaluateScenario('PERF-CATALOG-LIST', stats, PERF_SLO_P95_MS['PERF-CATALOG-LIST']),
      );
    }

    // PERF-CART-CREATE-ADD — fresh service per iteration (clean stores)
    {
      const stats = await measureAsync(
        async () => {
          const carts = buildCartService();
          const cart = await carts.create({});
          const withLine = await carts.addLine({
            cartId: cart.id,
            variantId: 'var-1',
            quantity: 1,
          });
          expect(withLine.lines).toHaveLength(1);
        },
        { warmup: WARMUP, iterations: ITERS },
      );
      results.push(
        evaluateScenario('PERF-CART-CREATE-ADD', stats, PERF_SLO_P95_MS['PERF-CART-CREATE-ADD']),
      );
    }

    // PERF-CHECKOUT-PREPARE
    {
      const checkout = buildCheckoutService();
      const stats = await measureAsync(
        async () => {
          const preview = await checkout.prepare('cart-1');
          expect(preview.totals.totalMinor).toBe('2500');
        },
        { warmup: WARMUP, iterations: ITERS },
      );
      results.push(
        evaluateScenario('PERF-CHECKOUT-PREPARE', stats, PERF_SLO_P95_MS['PERF-CHECKOUT-PREPARE']),
      );
    }

    // PERF-ORDERS-PLACE
    {
      const orders = buildOrdersService();
      const cartId = '22222222-2222-2222-2222-222222222222';
      const stats = await measureAsync(
        async () => {
          const order = await orders.placeOrder({
            cartId,
            paymentMethod: 'manual',
          });
          expect(order.status).toBe('confirmed');
        },
        { warmup: WARMUP, iterations: ITERS },
      );
      results.push(
        evaluateScenario('PERF-ORDERS-PLACE', stats, PERF_SLO_P95_MS['PERF-ORDERS-PLACE']),
      );
    }

    for (const line of results.map(formatScenarioLine)) {
      // eslint-disable-next-line no-console -- intentional benchmark output
      console.log(`[perf-bench] ${line}`);
    }

    const failed = results.filter((r) => !r.pass);
    expect(failed, failed.map(formatScenarioLine).join('\n') || 'all scenarios pass').toHaveLength(
      0,
    );
  }, 60_000);
});
