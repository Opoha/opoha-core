import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { verifyPassword } from '../seed/password';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('creates a user with a hashed password and omits hash from the result', async () => {
    const save = vi.fn().mockImplementation(async (entity) => {
      expect(entity.passwordHash).toMatch(/^scrypt\$/);
      expect(verifyPassword('plain-secret', entity.passwordHash)).toBe(true);
      return {
        id: 'u1',
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
    const service = new UsersService(users as never);
    const user = await service.create({
      email: 'Staff@Example.com',
      password: 'plain-secret',
    });
    expect(user.email).toBe('staff@example.com');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate emails on create', async () => {
    const users = { findOne: vi.fn().mockResolvedValue({ id: 'existing' }) };
    const service = new UsersService(users as never);
    await expect(
      service.create({ email: 'a@b.c', password: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when user missing', async () => {
    const users = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new UsersService(users as never);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
