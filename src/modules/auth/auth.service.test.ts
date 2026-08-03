import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuditAction } from './audit/audit-actions';
import { AuthService } from './auth.service';
import { hashPassword } from './seed/password';

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

describe('AuthService.login', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('issues access and refresh tokens for valid credentials', async () => {
    const passwordHash = hashPassword('good-pass');
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: USER_ID,
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
    const audit = mockAudit();
    const eventBus = mockEventBus();
    const service = new AuthService(
      usersService as never,
      jwtService as never,
      refreshTokensService as never,
      audit as never,
      eventBus as never,
    );

    const result = await service.login('admin@example.com', 'good-pass');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBe('opr_refresh_raw');
    expect(result.user.email).toBe('admin@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: USER_ID,
      email: 'admin@example.com',
    });
    expect(refreshTokensService.issue).toHaveBeenCalledWith(USER_ID);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.LOGIN_SUCCESS,
        actorUserId: USER_ID,
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'LoginSucceeded',
        aggregateId: USER_ID,
        data: { userId: USER_ID, email: 'admin@example.com' },
      }),
    );
  });

  it('rejects invalid passwords and audits failure', async () => {
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: USER_ID,
        email: 'admin@example.com',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        passwordHash: hashPassword('good-pass'),
      }),
    };
    const audit = mockAudit();
    const eventBus = mockEventBus();
    const service = new AuthService(
      usersService as never,
      { signAsync: vi.fn() } as never,
      { issue: vi.fn() } as never,
      audit as never,
      eventBus as never,
    );
    await expect(service.login('admin@example.com', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.LOGIN_FAILURE }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'LoginFailed',
        data: expect.objectContaining({
          reason: 'invalid_credentials',
          userId: USER_ID,
        }),
      }),
    );
  });

  it('rejects inactive users', async () => {
    const usersService = {
      findByEmailWithHash: vi.fn().mockResolvedValue({
        id: USER_ID,
        email: 'admin@example.com',
        isActive: false,
        createdAt: now,
        updatedAt: now,
        passwordHash: hashPassword('good-pass'),
      }),
    };
    const eventBus = mockEventBus();
    const service = new AuthService(
      usersService as never,
      { signAsync: vi.fn() } as never,
      { issue: vi.fn() } as never,
      mockAudit() as never,
      eventBus as never,
    );
    await expect(
      service.login('admin@example.com', 'good-pass'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'LoginFailed',
        data: expect.objectContaining({ reason: 'inactive' }),
      }),
    );
  });
});

describe('AuthService.refresh', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('rotates refresh and issues a new access token', async () => {
    const usersService = {
      findById: vi.fn().mockResolvedValue({
        id: USER_ID,
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
        userId: USER_ID,
        refreshToken: 'opr_new_refresh',
      }),
    };
    const audit = mockAudit();
    const service = new AuthService(
      usersService as never,
      jwtService as never,
      refreshTokensService as never,
      audit as never,
      mockEventBus() as never,
    );

    const result = await service.refresh('opr_old_refresh');

    expect(result.accessToken).toBe('new.access.token');
    expect(result.refreshToken).toBe('opr_new_refresh');
    expect(refreshTokensService.rotate).toHaveBeenCalledWith('opr_old_refresh');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.REFRESH }),
    );
  });

  it('rejects when rotated user is inactive', async () => {
    const service = new AuthService(
      {
        findById: vi.fn().mockResolvedValue({
          id: USER_ID,
          email: 'admin@example.com',
          isActive: false,
          createdAt: now,
          updatedAt: now,
        }),
      } as never,
      { signAsync: vi.fn() } as never,
      {
        rotate: vi.fn().mockResolvedValue({
          userId: USER_ID,
          refreshToken: 'opr_new',
        }),
      } as never,
      mockAudit() as never,
      mockEventBus() as never,
    );
    await expect(service.refresh('opr_old')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
