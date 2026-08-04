import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_ADMIN_ROLE_NAME } from '../seed/seed-auth';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('creates a role and replaces permissions', async () => {
    const roles = {
      find: vi.fn(),
      findOne: vi.fn().mockResolvedValueOnce({
        id: 'r1',
        name: 'editor',
        description: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        rolePermissions: [],
      }),
      create: vi.fn((v: unknown) => v),
      save: vi.fn().mockResolvedValue({
        id: 'r1',
        name: 'editor',
        description: null,
      }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const permissions = {
      find: vi.fn().mockResolvedValue([{ id: 'p1' }]),
    };
    const rolePermissions = {
      delete: vi.fn(),
      create: vi.fn((v: unknown) => v),
      save: vi.fn(),
    };
    const auditLogs = { append: vi.fn() };

    const service = new RolesService(
      roles as never,
      permissions as never,
      rolePermissions as never,
      { findOne: vi.fn() } as never,
      { findOne: vi.fn(), save: vi.fn(), delete: vi.fn(), create: vi.fn() } as never,
      auditLogs as never,
    );

    const created = await service.create({ name: 'Editor', permissionIds: ['p1'] }, 'actor');

    expect(created.name).toBe('editor');
    expect(rolePermissions.delete).toHaveBeenCalledWith({ roleId: 'r1' });
    expect(rolePermissions.save).toHaveBeenCalled();
    expect(auditLogs.append).toHaveBeenCalled();
  });

  it('refuses to delete the default admin role', async () => {
    const roles = {
      findOne: vi.fn().mockResolvedValue({
        id: 'r-admin',
        name: DEFAULT_ADMIN_ROLE_NAME,
        description: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      }),
      delete: vi.fn(),
    };
    const service = new RolesService(
      roles as never,
      { find: vi.fn() } as never,
      { delete: vi.fn(), create: vi.fn(), save: vi.fn() } as never,
      { findOne: vi.fn() } as never,
      { findOne: vi.fn(), save: vi.fn(), delete: vi.fn(), create: vi.fn() } as never,
      { append: vi.fn() } as never,
    );

    await expect(service.remove('r-admin')).rejects.toThrow(/Cannot delete the default admin role/);
    expect(roles.delete).not.toHaveBeenCalled();
  });
});
