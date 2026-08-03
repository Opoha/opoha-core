import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { hashPassword } from './seed/password';

describe('AuthService.login', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('issues an access token for valid credentials', async () => {
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
    const service = new AuthService(usersService as never, jwtService as never);

    const result = await service.login('admin@example.com', 'good-pass');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.email).toBe('admin@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'admin@example.com',
    });
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
    );
    await expect(
      service.login('admin@example.com', 'good-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
