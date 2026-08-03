import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../audit/audit-actions';
import { hashOpaqueToken } from '../crypto/token-hash';
import { ApiKeysService } from './api-keys.service';

function mockAudit() {
  return { append: vi.fn().mockResolvedValue({ id: 'aud' }) };
}

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
    );
    await expect(
      service.create('user-1', {
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
        id: 'ak-1',
        userId: 'user-1',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      }));
    const apiKeys = {
      save: saveKey,
      create: vi.fn((data) => data),
      findOne: vi.fn().mockResolvedValue({
        id: 'ak-1',
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
    );

    const result = await service.create('user-1', {
      name: 'ci',
      permissionKeys: ['api-key:read'],
    });

    expect(result.secret.startsWith('opk_')).toBe(true);
    expect(result.apiKey.permissionKeys).toEqual(['api-key:read']);
    expect(saveKey.mock.calls[0][0].keyHash).toBe(
      hashOpaqueToken(result.secret),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.API_KEY_CREATE,
        actorUserId: 'user-1',
        resourceId: 'ak-1',
      }),
    );
  });

  it('authenticates a valid API key into AuthUser with scoped permissions', async () => {
    const apiKeys = {
      findOne: vi.fn().mockResolvedValue({
        id: 'ak-1',
        revokedAt: null,
        user: { id: 'user-1', email: 'a@b.c', isActive: true },
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
    );

    const authUser = await service.authenticate('opk_secret');
    expect(authUser).toEqual({
      userId: 'user-1',
      email: 'a@b.c',
      apiKeyId: 'ak-1',
      permissions: ['api-key:read', 'user:read'],
    });
    expect(apiKeys.update).toHaveBeenCalled();
  });
});
