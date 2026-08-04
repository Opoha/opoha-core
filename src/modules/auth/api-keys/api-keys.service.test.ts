import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../audit/audit-actions';
import { hashOpaqueToken } from '../crypto/token-hash';
import { ApiKeysService } from './api-keys.service';

function mockAudit() {
  return { append: vi.fn().mockResolvedValue({ id: 'aud' }) };
}

function mockEventBus() {
  return {
    publish: vi.fn().mockResolvedValue({
      event: {},
      listenerCount: 0,
      failures: [],
    }),
  };
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const API_KEY_ID = '22222222-2222-4222-8222-222222222222';

describe('ApiKeysService', () => {
  it('rejects scopes outside owner permissions', async () => {
    const service = new ApiKeysService(
      {} as never,
      {} as never,
      {} as never,
      {
        listKeysForUser: vi.fn().mockResolvedValue(['api-key:read']),
      } as never,
      mockAudit() as never,
      mockEventBus() as never,
    );
    await expect(
      service.create(USER_ID, {
        name: 'ci',
        permissionKeys: ['user:delete'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a hashed key with scoped permissions and audits', async () => {
    const saveKey = vi
      .fn()
      .mockImplementation(async (entity: { name: string; keyPrefix: string; keyHash: string }) => ({
        ...entity,
        id: API_KEY_ID,
        userId: USER_ID,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      }));
    const apiKeys = {
      save: saveKey,
      create: vi.fn((data) => data),
      findOne: vi.fn().mockResolvedValue({
        id: API_KEY_ID,
        name: 'ci',
        keyPrefix: 'opk_xxxx',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        apiKeyPermissions: [{ permission: { key: 'api-key:read' } }],
      }),
    };
    const permissions = {
      find: vi.fn().mockResolvedValue([{ id: 'p1', key: 'api-key:read' }]),
    };
    const apiKeyPermissions = {
      save: vi.fn().mockResolvedValue([]),
      create: vi.fn((data) => data),
    };
    const audit = mockAudit();
    const eventBus = mockEventBus();
    const service = new ApiKeysService(
      apiKeys as never,
      permissions as never,
      apiKeyPermissions as never,
      {
        listKeysForUser: vi
          .fn()
          .mockResolvedValue(['api-key:read', 'api-key:create']),
      } as never,
      audit as never,
      eventBus as never,
    );

    const result = await service.create(USER_ID, {
      name: 'ci',
      permissionKeys: ['api-key:read'],
    });

    expect(result.secret.startsWith('opk_')).toBe(true);
    expect(result.apiKey.permissionKeys).toEqual(['api-key:read']);
    const savedKey = saveKey.mock.calls[0]?.[0];
    expect(savedKey).toBeDefined();
    expect(savedKey!.keyHash).toBe(hashOpaqueToken(result.secret));
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.API_KEY_CREATE,
        actorUserId: USER_ID,
        resourceId: API_KEY_ID,
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ApiKeyCreated',
        aggregateId: API_KEY_ID,
        data: expect.objectContaining({
          apiKeyId: API_KEY_ID,
          ownerUserId: USER_ID,
        }),
      }),
    );
  });

  it('authenticates a valid API key into AuthUser with scoped permissions', async () => {
    const apiKeys = {
      findOne: vi.fn().mockResolvedValue({
        id: API_KEY_ID,
        revokedAt: null,
        user: { id: USER_ID, email: 'a@b.c', isActive: true },
        apiKeyPermissions: [
          { permission: { key: 'user:read' } },
          { permission: { key: 'api-key:read' } },
        ],
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const service = new ApiKeysService(
      apiKeys as never,
      {} as never,
      {} as never,
      {} as never,
      mockAudit() as never,
      mockEventBus() as never,
    );

    const authUser = await service.authenticate('opk_secret');
    expect(authUser).toEqual({
      userId: USER_ID,
      email: 'a@b.c',
      apiKeyId: API_KEY_ID,
      permissions: ['api-key:read', 'user:read'],
    });
    expect(apiKeys.update).toHaveBeenCalled();
  });
});
