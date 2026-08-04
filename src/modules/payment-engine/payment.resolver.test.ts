import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { PaymentEngine } from './payment-engine.service';
import { PaymentResolver } from './payment.resolver';

/**
 * A-06 — payment GraphQL permission metadata + resolver behavior.
 */
describe('PaymentResolver RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => PaymentResolver,
      getHandler: () => handler,
    };
  }

  it('declares payment:read/authorize/capture/refund permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.payment)).toEqual([
      'payment:read',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.paymentsByOrder),
    ).toEqual(['payment:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.paymentProviders),
    ).toEqual(['payment:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.authorizePayment),
    ).toEqual(['payment:authorize']);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.capturePayment)).toEqual(
      ['payment:capture'],
    );
    expect(reflector.get(REQUIRE_PERMISSION_KEY, PaymentResolver.prototype.refundPayment)).toEqual([
      'payment:refund',
    ]);
  });

  it('PermissionsGuard denies capturePayment without payment:capture', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['payment:capture'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(
      guard.canActivate(
        gqlContext(
          {
            user: {
              userId: 'u1',
              email: 'clerk@example.com',
              permissions: ['payment:read'],
            },
          },
          PaymentResolver.prototype.capturePayment,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows authorizePayment when payment:authorize granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['payment:authorize']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(
      guard.canActivate(
        gqlContext(
          {
            user: {
              userId: 'u1',
              email: 'admin@example.com',
              permissions: ['payment:authorize', 'payment:read'],
            },
          },
          PaymentResolver.prototype.authorizePayment,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});

describe('PaymentResolver behavior', () => {
  let engine: {
    authorize: ReturnType<typeof vi.fn>;
    capture: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByOrderId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let resolver: PaymentResolver;

  const paymentRow = {
    id: 'pay-1',
    orderId: 'order-1',
    providerCode: 'manual',
    status: 'authorized',
    amountMinor: '1000',
    currencyCode: 'USD',
    externalId: null,
    idempotencyKey: null,
    metadata: { cartId: 'cart-1' },
    errorMessage: null,
    authorizedAt: new Date('2026-08-03T12:00:00Z'),
    capturedAt: null,
    refundedAt: null,
    failedAt: null,
    createdAt: new Date('2026-08-03T12:00:00Z'),
    updatedAt: new Date('2026-08-03T12:00:00Z'),
  };

  beforeEach(() => {
    engine = {
      authorize: vi.fn(async () => paymentRow),
      capture: vi.fn(async () => paymentRow),
      refund: vi.fn(async () => paymentRow),
      findById: vi.fn(async () => paymentRow),
      findByOrderId: vi.fn(async () => [paymentRow]),
      list: vi.fn(() => [{ code: 'manual', displayName: 'Manual' }]),
    };
    resolver = new PaymentResolver(engine as unknown as PaymentEngine);
  });

  it('payment query maps entity to PaymentType with metadataJson', async () => {
    const result = await resolver.payment('pay-1');
    expect(engine.findById).toHaveBeenCalledWith('pay-1');
    expect(result.id).toBe('pay-1');
    expect(result.metadataJson).toBe(JSON.stringify({ cartId: 'cart-1' }));
  });

  it('paymentsByOrder query lists payments for an order', async () => {
    const result = await resolver.paymentsByOrder('order-1');
    expect(engine.findByOrderId).toHaveBeenCalledWith('order-1');
    expect(result).toHaveLength(1);
  });

  it('paymentProviders query lists registered providers', () => {
    const result = resolver.paymentProviders();
    expect(result).toEqual([{ code: 'manual', displayName: 'Manual' }]);
  });

  it('authorizePayment parses metadataJson and forwards to engine', async () => {
    await resolver.authorizePayment({
      providerCode: 'manual',
      orderId: 'order-1',
      amount: { amountMinor: '1000', currencyCode: 'USD' },
      idempotencyKey: 'idem-1',
      metadataJson: JSON.stringify({ cartId: 'cart-1' }),
    });
    expect(engine.authorize).toHaveBeenCalledWith({
      providerCode: 'manual',
      orderId: 'order-1',
      amount: { amountMinor: '1000', currencyCode: 'USD' },
      idempotencyKey: 'idem-1',
      metadata: { cartId: 'cart-1' },
    });
  });

  it('authorizePayment rejects invalid metadataJson', async () => {
    await expect(
      resolver.authorizePayment({
        providerCode: 'manual',
        orderId: 'order-1',
        amount: { amountMinor: '1000', currencyCode: 'USD' },
        metadataJson: 'not-json',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('capturePayment forwards paymentId and amount to engine', async () => {
    await resolver.capturePayment({ paymentId: 'pay-1' });
    expect(engine.capture).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      amount: undefined,
      idempotencyKey: undefined,
    });
  });

  it('refundPayment forwards paymentId and amount to engine', async () => {
    await resolver.refundPayment({ paymentId: 'pay-1' });
    expect(engine.refund).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      amount: undefined,
      idempotencyKey: undefined,
    });
  });
});
