/**
 * Digital gate smoke.
 * Purchase of a digital SKU yields a secure download link (and license key)
 * without shipping / stock reservation (ADR-0010 TypeORM; core-owned).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { CheckoutService } from '../order/checkout.service';
import type { CartService } from '../order/cart.service';
import { OrdersService } from '../order/orders.service';
import { DigitalFulfillmentService } from './digital-fulfillment.service';
import { DigitalDownloadTokenEntity } from './entities/download-token.entity';
import { DigitalLicenseKeyEntity } from './entities/license-key.entity';

type TokenRow = {
  id: string;
  token: string;
  orderId: string;
  orderLineId: string;
  variantId: string;
  customerId: string | null;
  assetUrl: string;
  status: string;
  maxDownloads: number;
  downloadCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LicenseRow = {
  id: string;
  licenseKey: string;
  orderId: string;
  orderLineId: string;
  variantId: string;
  customerId: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('Digital gate smoke', () => {
  const now = new Date('2026-08-04T03:30:00Z');
  const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const cartId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const cartLineId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const variantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const customerId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const paymentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  let tokenStore: TokenRow[];
  let licenseStore: LicenseRow[];
  let digital: DigitalFulfillmentService;
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let inventoryCommit: ReturnType<typeof vi.fn>;

  function buildDigitalService(fulfillmentMode: 'digital' | 'physical'): DigitalFulfillmentService {
    tokenStore = [];
    licenseStore = [];
    let tokenSeq = 0;
    let licenseSeq = 0;

    const tokensRepo = {
      find: vi.fn(async ({ where }: { where: Partial<TokenRow> }) =>
        tokenStore
          .filter((row) => Object.entries(where).every(([k, v]) => row[k as keyof TokenRow] === v))
          .map((row) => Object.assign(new DigitalDownloadTokenEntity(), row)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<TokenRow> }) => {
        const row = tokenStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof TokenRow] === v),
        );
        return row ? Object.assign(new DigitalDownloadTokenEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<TokenRow>) => ({
        id: `tok-${++tokenSeq}`,
        downloadCount: 0,
        status: 'active',
        maxDownloads: 5,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (rows: TokenRow | TokenRow[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        for (const row of list) {
          tokenStore.push({ ...row, createdAt: now, updatedAt: now });
        }
        return list;
      }),
    };

    const licensesRepo = {
      find: vi.fn(async ({ where }: { where: Partial<LicenseRow> }) =>
        licenseStore
          .filter((row) =>
            Object.entries(where).every(([k, v]) => row[k as keyof LicenseRow] === v),
          )
          .map((row) => Object.assign(new DigitalLicenseKeyEntity(), row)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<LicenseRow> }) => {
        const row = licenseStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof LicenseRow] === v),
        );
        return row ? Object.assign(new DigitalLicenseKeyEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<LicenseRow>) => ({
        id: `lic-${++licenseSeq}`,
        status: 'active',
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (rows: LicenseRow | LicenseRow[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        for (const row of list) {
          licenseStore.push({ ...row, createdAt: now, updatedAt: now });
        }
        return list;
      }),
    };

    return new DigitalFulfillmentService(
      tokensRepo as never,
      licensesRepo as never,
      {
        find: vi.fn(async () => [{ id: variantId, fulfillmentMode }]),
      } as never,
      eventBus as never,
    );
  }

  function buildOrdersService(opts: {
    fulfillmentMode: 'digital' | 'physical';
    reservationId: string | null;
  }): OrdersService {
    digital = buildDigitalService(opts.fulfillmentMode);
    inventoryCommit = vi.fn(async () => {
      if (opts.fulfillmentMode === 'digital') {
        throw new Error('digital purchase must not commit inventory');
      }
      return { id: opts.reservationId, status: 'committed' };
    });

    let orderRow: Record<string, unknown> = {
      id: orderId,
      storeId: 'store-digital',
      customerId,
      companyId: null,
      cartId,
      status: 'pending',
      orderSource: 'web',
      vendorId: null,
      currencyCode: 'USD',
      subtotalMinor: '1999',
      taxMinor: '0',
      shippingMinor: '0',
      discountMinor: '0',
      couponCode: null,
      giftCardCode: null,
      giftCardMinor: '0',
      loyaltyPointsRedeemed: 0,
      loyaltyMinor: '0',
      shippingMethodCode: opts.fulfillmentMode === 'physical' ? 'flat' : null,
      shippingRateCode: opts.fulfillmentMode === 'physical' ? 'standard' : null,
      totalMinor: '1999',
      createdAt: now,
      updatedAt: now,
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
      get: vi.fn(() => ({ code: 'manual', displayName: 'Manual' })),
      authorize: vi.fn(async () => ({
        id: paymentId,
        orderId,
        providerCode: 'manual',
        status: 'authorized',
        amountMinor: '1999',
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

    return new OrdersService(
      {
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
      } as never,
      {
        find: vi.fn(async () => []),
        create: vi.fn((data: unknown) => data),
        save: vi.fn(async (rows: Array<Record<string, unknown>>) =>
          rows.map((row, i) => ({
            id: `ol-${i + 1}`,
            createdAt: now,
            vendorId: null,
            ...row,
          })),
        ),
      } as never,
      {
        find: vi.fn(async () => [
          {
            id: variantId,
            productId: 'prod-1',
            fulfillmentMode: opts.fulfillmentMode,
          },
        ]),
      } as never,
      {
        find: vi.fn(async () => [{ id: 'prod-1', vendorId: null }]),
      } as never,
      {
        getEntityWithLines: vi.fn(async () => ({
          cart: {
            id: cartId,
            storeId: 'store-digital',
            customerId,
            companyId: null,
            status: 'locked',
            currencyCode: 'USD',
            shippingMethodCode: opts.fulfillmentMode === 'physical' ? 'flat' : null,
            shippingRateCode: opts.fulfillmentMode === 'physical' ? 'standard' : null,
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
              id: cartLineId,
              cartId,
              variantId,
              quantity: 1,
              unitPriceMinor: '1999',
              reservationId: opts.reservationId,
            },
          ],
        })),
        setStatus: vi.fn(async () => undefined),
      } as unknown as CartService,
      { commit: inventoryCommit } as never,
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
      digital,
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
  }

  beforeEach(() => {
    eventBus = { publish: vi.fn(async () => ({ ok: true })) };
  });

  it('purchase digital SKU → placeOrder delivers download link + license', async () => {
    const orders = buildOrdersService({
      fulfillmentMode: 'digital',
      reservationId: null,
    });

    const order = await orders.placeOrder({
      cartId,
      paymentMethod: 'manual',
    });

    expect(order.status).toBe('confirmed');
    expect(order.id).toBe(orderId);
    expect(inventoryCommit).not.toHaveBeenCalled();

    const tokens = await digital.listDownloadTokensForOrder(orderId);
    const licenses = await digital.listLicenseKeysForOrder(orderId);
    expect(tokens).toHaveLength(1);
    expect(licenses).toHaveLength(1);

    const download = tokens[0]!;
    expect(download.status).toBe('active');
    expect(download.customerId).toBe(customerId);
    expect(download.token).toMatch(/^[a-f0-9]{32}$/);
    expect(download.assetUrl).toBe(`/digital/assets/${variantId}?token=${download.token}`);
    expect(licenses[0]!.licenseKey).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

    const byCustomer = await digital.listDownloadTokensForCustomer(customerId);
    expect(byCustomer).toHaveLength(1);
    expect(byCustomer[0]!.assetUrl).toContain(`token=${download.token}`);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.DigitalFulfillmentIssued,
        aggregateType: 'order',
        aggregateId: orderId,
        data: expect.objectContaining({
          orderId,
          customerId,
          lineCount: 1,
        }),
      }),
    );
  });

  it('physical SKU purchase does not issue download links', async () => {
    const orders = buildOrdersService({
      fulfillmentMode: 'physical',
      reservationId: 'res-physical',
    });

    await orders.placeOrder({ cartId, paymentMethod: 'manual' });

    const tokens = await digital.listDownloadTokensForOrder(orderId);
    expect(tokens).toHaveLength(0);
    expect(inventoryCommit).toHaveBeenCalledWith('res-physical');
    expect(
      eventBus.publish.mock.calls.some(
        (call) => call[0].eventName === CoreEventName.DigitalFulfillmentIssued,
      ),
    ).toBe(false);
  });

  it('prepareCheckout skips inventory reserve for digital SKUs', async () => {
    const reserveForStore = vi.fn(async () => {
      throw new Error('must not reserve for digital');
    });

    const checkout = new CheckoutService(
      {
        getEntityWithLines: vi.fn(async () => ({
          cart: {
            id: cartId,
            storeId: 'store-digital',
            customerId,
            companyId: null,
            status: 'open',
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
              id: cartLineId,
              cartId,
              variantId,
              quantity: 1,
              unitPriceMinor: '1999',
              reservationId: null,
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
          id: cartId,
          status: 'locked',
          currencyCode: 'USD',
          taxMinor: '0',
          discountMinor: '0',
          giftCardMinor: '0',
          loyaltyMinor: '0',
          shippingMinor: '0',
          lines: [],
        })),
      } as never,
      { reserveForStore, release: vi.fn(async () => undefined) } as never,
      { save: vi.fn(async (line: unknown) => line) } as never,
      {
        find: vi.fn(async () => [{ id: variantId, fulfillmentMode: 'digital' }]),
      } as never,
      {
        calculateOrZero: vi.fn(async () => ({
          currencyCode: 'USD',
          pricingMode: 'exclusive',
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
        convertTotals: vi.fn(async (_storeId: string, totals: unknown) => ({
          ...(totals as object),
          settlementCurrencyCode: 'USD',
          displayCurrencyCode: 'USD',
          rate: 1,
          roundingMode: 'half_up',
        })),
      } as never,
    );

    const preview = await checkout.prepare(cartId);
    expect(reserveForStore).not.toHaveBeenCalled();
    expect(preview).toBeDefined();
  });
});
