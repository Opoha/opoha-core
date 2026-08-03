import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { hashOpaqueToken } from '../crypto/token-hash';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  it('rejects scopes outside owner permissions', async () => {
    const service = new ApiKeysService(
      {} as never,
      { listKeysForUser: vi.fn().mockResolvedValue(['api-key:read']) } as never,
    );
    await expect(service.create('user-1', { name: 'ci', permissionKeys: ['user:delete'] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a hashed key with scoped permissions', async () => {
    const create = vi.fn().mockImplementation(async ({ data }: { data: { keyHash: string; keyPrefix: string; name: string } }) => ({
      id: 'ak-1', name: data.name, keyPrefix: data.keyPrefix, keyHash: data.keyHash,
      lastUsedAt: null, revokedAt: null, createdAt: new Date(),
      permissions: [{ permission: { key: 'api-key:read' } }],
    }));
    const prisma = {
      permission: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', key: 'api-key:read' }]) },
      apiKey: { create },
    };
    const service = new ApiKeysService(prisma as never, {
      listKeysForUser: vi.fn().mockResolvedValue(['api-key:read', 'api-key:create']),
    } as never);
    const result = await service.create('user-1', { name: 'ci', permissionKeys: ['api-key:read'] });
    expect(result.secret.startsWith('opk_')).toBe(true);
    expect(result.apiKey.permissionKeys).toEqual(['api-key:read']);
    expect(create.mock.calls[0][0].data.keyHash).toBe(hashOpaqueToken(result.secret));
  });

  it('authenticates a valid key and returns scoped permissions', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      apiKey: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ak-1', revokedAt: null,
          user: { id: 'user-1', email: 'a@b.c', isActive: true },
          permissions: [{ permission: { key: 'user:read' } }, { permission: { key: 'api-key:read' } }],
        }),
        update,
      },
    };
    const service = new ApiKeysService(prisma as never, { listKeysForUser: vi.fn() } as never);
    const user = await service.authenticate('opk_raw');
    expect(user).toEqual({ userId: 'user-1', email: 'a@b.c', apiKeyId: 'ak-1', permissions: ['api-key:read', 'user:read'] });
    expect(update).toHaveBeenCalled();
  });

  it('rejects revoked API keys', async () => {
    const service = new ApiKeysService({
      apiKey: { findUnique: vi.fn().mockResolvedValue({ id: 'ak-1', revokedAt: new Date(), user: { id: 'user-1', email: 'a@b.c', isActive: true }, permissions: [] }) },
    } as never, { listKeysForUser: vi.fn() } as never);
    await expect(service.authenticate('opk_revoked')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes an owned API key', async () => {
    const existing = { id: 'ak-1', name: 'ci', keyPrefix: 'opk_abc', lastUsedAt: null, revokedAt: null, createdAt: new Date(), permissions: [{ permission: { key: 'api-key:read' } }] };
    const updated = { ...existing, revokedAt: new Date() };
    const prisma = { apiKey: { findFirst: vi.fn().mockResolvedValue(existing), update: vi.fn().mockResolvedValue(updated) } };
    const service = new ApiKeysService(prisma as never, { listKeysForUser: vi.fn() } as never);
    const result = await service.revoke('user-1', 'ak-1');
    expect(result.revokedAt).toBeInstanceOf(Date);
  });
});
