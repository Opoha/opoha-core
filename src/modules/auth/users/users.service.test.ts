import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { verifyPassword } from '../seed/password';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const now = new Date('2026-08-03T00:00:00.000Z');

  it('creates a user with a hashed password and omits hash from the result', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => {
      expect(data.passwordHash).toMatch(/^scrypt\$/);
      expect(verifyPassword('plain-secret', data.passwordHash)).toBe(true);
      return { id: 'u1', email: data.email, isActive: data.isActive, createdAt: now, updatedAt: now };
    });
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null), create } };
    const service = new UsersService(prisma as never);
    const user = await service.create({ email: 'Staff@Example.com', password: 'plain-secret' });
    expect(user.email).toBe('staff@example.com');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate emails on create', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ id: 'existing' }) } };
    const service = new UsersService(prisma as never);
    await expect(service.create({ email: 'a@b.c', password: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when user missing', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new UsersService(prisma as never);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
