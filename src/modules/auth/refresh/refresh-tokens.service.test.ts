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
    const save = vi.fn().mockResolvedValue({});
    const refreshTokens = { save, create: vi.fn((data) => data) };
    const service = new RefreshTokensService(refreshTokens as never, {} as never, config as never);

    const raw = await service.issue('user-1');
    expect(raw.startsWith('opr_')).toBe(true);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: hashOpaqueToken(raw),
      }),
    );
  });

  it('rejects unknown refresh tokens', async () => {
    const refreshTokens = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new RefreshTokensService(refreshTokens as never, {} as never, config as never);
    await expect(service.rotate('opr_missing')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects already-revoked tokens and clears siblings', async () => {
    const update = vi.fn().mockResolvedValue({ affected: 1 });
    const refreshTokens = {
      findOne: vi.fn().mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      update,
    };
    const service = new RefreshTokensService(refreshTokens as never, {} as never, config as never);
    await expect(service.rotate('opr_reused')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(update).toHaveBeenCalled();
  });
});
