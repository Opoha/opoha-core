import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { hashOpaqueToken } from '../crypto/token-hash';
import { RefreshTokensService } from './refresh-tokens.service';

describe('RefreshTokensService', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    }),
  };

  it('issues a hashed refresh token row', async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { refreshToken: { create } };
    const service = new RefreshTokensService(prisma as never, config as never);

    const raw = await service.issue('user-1');
    expect(raw.startsWith('opr_')).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: hashOpaqueToken(raw),
        }),
      }),
    );
  });

  it('rejects unknown refresh tokens', async () => {
    const prisma = {
      refreshToken: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new RefreshTokensService(prisma as never, config as never);
    await expect(service.rotate('opr_missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects already-revoked tokens and clears siblings', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      refreshToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'rt-1',
          userId: 'user-1',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany,
      },
    };
    const service = new RefreshTokensService(prisma as never, config as never);
    await expect(service.rotate('opr_reused')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(updateMany).toHaveBeenCalled();
  });
});
