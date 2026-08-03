import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../audit/audit-actions';
import { verifyPassword } from '../seed/password';
import { UsersService } from './users.service';

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

describe('UsersService', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('creates a user with a hashed password and omits hash from the result', async () => {
    const save = vi.fn().mockImplementation(async (entity) => {
      expect(entity.passwordHash).toMatch(/^scrypt\$/);
      expect(verifyPassword('plain-secret', entity.passwordHash)).toBe(true);
      return {
        id: '11111111-1111-4111-8111-111111111111',
        email: entity.email,
        isActive: entity.isActive,
        createdAt: now,
        updatedAt: now,
      };
    });
    const users = {
      findOne: vi.fn().mockResolvedValue(null),
      save,
      create: vi.fn((data) => data),
    };
    const audit = mockAudit();
    const eventBus = mockEventBus();
    const service = new UsersService(
      users as never,
      audit as never,
      eventBus as never,
    );
    const user = await service.create(
      {
        email: 'Staff@Example.com',
        password: 'plain-secret',
      },
      'actor-1',
    );
    expect(user.email).toBe('staff@example.com');
    expect(user).not.toHaveProperty('passwordHash');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.USER_CREATE,
        actorUserId: 'actor-1',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'UserRegistered',
        aggregateId: '11111111-1111-4111-8111-111111111111',
        metadata: { actorId: 'actor-1' },
      }),
    );
  });

  it('rejects duplicate emails on create', async () => {
    const users = { findOne: vi.fn().mockResolvedValue({ id: 'existing' }) };
    const service = new UsersService(
      users as never,
      mockAudit() as never,
      mockEventBus() as never,
    );
    await expect(
      service.create({ email: 'a@b.c', password: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when user missing', async () => {
    const users = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new UsersService(
      users as never,
      mockAudit() as never,
      mockEventBus() as never,
    );
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
