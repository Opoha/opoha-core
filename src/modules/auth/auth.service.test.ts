import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { hashPassword } from './seed/password';

describe('AuthService.login', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('issues access and refresh tokens for valid credentials', async () => {
    const passwordHash = hashPassword('good-pass');
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        passwordHash,
      }),
    };
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
    };
    const refreshTokensService = {
      issue: vi.fn().mockResolvedValue('opr_refresh_raw'),
    };
    const service = new AuthService(
      usersService as never,
      jwtService as never,
      refreshTokensService as never,
    );

    const result = await service.login('admin@example.com', 'good-pass');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBe('opr_refresh_raw');
    expect(result.user.email).toBe('admin@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'admin@example.com',
    });
    expect(refreshTokensService.issue).toHaveBeenCalledWith('user-1');
  });

  it('rejects invalid passwords', async () => {
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        passwordHash: hashPassword('good-pass'),
      }),
    };
    const service = new AuthService(
      usersService as never,
      { signAsync: vi.fn() } as never,
      { issue: vi.fn() } as never,
    );
    await expect(service.login('admin@example.com', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive users', async () => {
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        isActive: false,
        createdAt: now,
        updatedAt: now,
        passwordHash: hashPassword('good-pass'),
      }),
    };
    const service = new AuthService(
      usersService as never,
      { signAsync: vi.fn() } as never,
      { issue: vi.fn() } as never,
    );
    await expect(
      service.login('admin@example.com', 'good-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('rotates refresh and issues a new access token', async () => {
    const usersService = {
      findById: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    };
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('new.access.token'),
    };
    const refreshTokensService = {
      rotate: vi.fn().mockResolvedValue({
        userId: 'user-1',
        refreshToken: 'opr_new_refresh',
      }),
    };
    const service = new AuthService(
      usersService as never,
      jwtService as never,
      refreshTokensService as never,
    );

    const result = await service.refresh('opr_old_refresh');

    expect(result.accessToken).toBe('new.access.token');
    expect(result.refreshToken).toBe('opr_new_refresh');
    expect(refreshTokensService.rotate).toHaveBeenCalledWith('opr_old_refresh');
  });

  it('rejects when rotated user is inactive', async () => {
    const service = new AuthService(
      {
        findById: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'admin@example.com',
          isActive: false,
          createdAt: now,
          updatedAt: now,
        }),
      } as never,
      { signAsync: vi.fn() } as never,
      {
        rotate: vi.fn().mockResolvedValue({
          userId: 'user-1',
          refreshToken: 'opr_new',
        }),
      } as never,
    );
    await expect(service.refresh('opr_old')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
