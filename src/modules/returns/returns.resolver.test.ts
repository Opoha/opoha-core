import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { ReturnsResolver } from './returns.resolver';
import { ReturnsService } from './returns.service';

/**
 * E-03 — returns GraphQL permission metadata + resolver wiring.
 */
describe('ReturnsResolver RBAC (resolver metadata + PermissionsGuard)', () => {
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByOrderId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    receive: ReturnType<typeof vi.fn>;
    completeRefund: ReturnType<typeof vi.fn>;
    completeExchange: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let resolver: ReturnsResolver;

  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => ReturnsResolver,
      getHandler: () => handler,
    };
  }

  beforeEach(() => {
    service = {
      findAll: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'r1' })),
      findByOrderId: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 'r1', status: 'requested' })),
      approve: vi.fn(async () => ({ id: 'r1', status: 'approved' })),
      receive: vi.fn(async () => ({ id: 'r1', status: 'received' })),
      completeRefund: vi.fn(async () => ({ id: 'r1', status: 'refunded' })),
      completeExchange: vi.fn(async () => ({ id: 'r1', status: 'exchanged' })),
      cancel: vi.fn(async () => ({ id: 'r1', status: 'cancelled' })),
    };
    resolver = new ReturnsResolver(service as unknown as ReturnsService);
  });

  it('declares return:* permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.returns)).toEqual([
      'return:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.returnById)).toEqual([
      'return:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.returnsByOrder)).toEqual(
      ['return:read'],
    );
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.createReturn)).toEqual([
      'return:create',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.approveReturn)).toEqual([
      'return:approve',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.receiveReturn)).toEqual([
      'return:receive',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.completeReturnRefund),
    ).toEqual(['return:refund']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.completeReturnExchange),
    ).toEqual(['return:exchange']);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReturnsResolver.prototype.cancelReturn)).toEqual([
      'return:cancel',
    ]);
  });

  it('PermissionsGuard denies completeReturnRefund without return:refund', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['return:refund'] : undefined,
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
              permissions: ['return:read'],
            },
          },
          ReturnsResolver.prototype.completeReturnRefund,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates createReturn / completeReturnRefund to service', async () => {
    await resolver.createReturn({
      orderId: 'o1',
      warehouseId: 'w1',
      resolution: 'refund',
      lines: [{ orderLineId: 'ol1', quantity: 1 }],
    });
    expect(service.create).toHaveBeenCalledWith({
      orderId: 'o1',
      warehouseId: 'w1',
      resolution: 'refund',
      lines: [{ orderLineId: 'ol1', quantity: 1 }],
    });

    await resolver.completeReturnRefund({
      returnId: 'r1',
      amountMinor: '1000',
    });
    expect(service.completeRefund).toHaveBeenCalledWith({
      returnId: 'r1',
      amountMinor: '1000',
    });
  });
});
