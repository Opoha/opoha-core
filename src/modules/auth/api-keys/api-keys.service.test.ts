import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { hashOpaqueToken } from '../crypto/token-hash';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  it('rejects scopes outside owner permissions', async () => {
    const service = new ApiKeysService(
      {} as never,
      {} as never,
      {} as never,
      {
        listKeysForUser: vi.fn().mockResolvedValue(['api-key:read']),
      } as never,
    );
    await expect(
      service.create('user-1', {
        name: 'ci',
        permissionKeys: ['user:delete'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a hashed key with scoped permissions', async () => {
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
    const service = new ApiKeysService(
      apiKeys as never,
      permissions as never,
      apiKeyPermissions as never,
      {
        listKeysForUser: vi
          .fn()
          .mockResolvedValue(['api-key:read', 'api-key:create']),
      } as never,
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
  });
});
