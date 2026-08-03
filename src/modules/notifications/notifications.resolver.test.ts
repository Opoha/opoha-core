import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';

/**
 * F-05 — notification GraphQL permission metadata + resolver behavior.
 */
describe('NotificationsResolver RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(
    req: { user?: unknown },
    handler: (...args: never[]) => unknown,
  ) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => NotificationsResolver,
      getHandler: () => handler,
    };
  }

  it('declares notification:read permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        NotificationsResolver.prototype.notificationProviders,
      ),
    ).toEqual(['notification:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        NotificationsResolver.prototype.notificationTemplates,
      ),
    ).toEqual(['notification:read']);
  });

  it('PermissionsGuard denies notificationProviders without notification:read', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['notification:read'] : undefined,
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
          NotificationsResolver.prototype.notificationProviders,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows notificationProviders when notification:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['notification:read']),
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
              permissions: ['notification:read'],
            },
          },
          NotificationsResolver.prototype.notificationProviders,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});

describe('NotificationsResolver behavior', () => {
  let resolver: NotificationsResolver;
  let service: {
    list: ReturnType<typeof vi.fn>;
    listTemplates: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(),
      listTemplates: vi.fn(),
    };
    resolver = new NotificationsResolver(
      service as unknown as NotificationsService,
    );
  });

  it('notificationProviders lists registered providers with default email channel', () => {
    service.list.mockReturnValue([
      { code: 'smtp', displayName: 'SMTP' },
      {
        code: 'resend',
        displayName: 'Resend',
        channels: ['email'],
      },
    ]);
    expect(resolver.notificationProviders()).toEqual([
      { code: 'smtp', displayName: 'SMTP', channels: ['email'] },
      { code: 'resend', displayName: 'Resend', channels: ['email'] },
    ]);
  });

  it('notificationTemplates lists registered templates', () => {
    service.listTemplates.mockReturnValue([
      {
        code: 'order.confirmation',
        description: 'Order confirmation',
        render: () => ({ subject: '', bodyText: '' }),
      },
    ]);
    expect(resolver.notificationTemplates()).toEqual([
      { code: 'order.confirmation', description: 'Order confirmation' },
    ]);
  });
});
