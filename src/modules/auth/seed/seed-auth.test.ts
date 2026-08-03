import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADMIN_ROLE_NAME,
  DEFAULT_PERMISSIONS,
  seedAuth,
  type SeedAuthStore,
} from './seed-auth';

function createMemoryStore(): SeedAuthStore & {
  snapshot: () => {
    roles: string[];
    permissions: string[];
    rolePermissions: number;
    users: string[];
    userRoles: number;
  };
} {
  const roles = new Map<string, { id: string; name: string; description: string }>();
  const permissions = new Map<
    string,
    { id: string; key: string; description: string }
  >();
  const rolePermissions = new Set<string>();
  const users = new Map<string, { id: string; email: string; passwordHash: string }>();
  const userRoles = new Set<string>();
  let seq = 0;
  const nextId = () => `id-${++seq}`;

  return {
    role: {
      async upsert({ where, create, update }) {
        const existing = roles.get(where.name);
        if (existing) {
          existing.description = update.description;
          return { id: existing.id, name: existing.name };
        }
        const row = { id: nextId(), name: create.name, description: create.description };
        roles.set(row.name, row);
        return { id: row.id, name: row.name };
      },
    },
    permission: {
      async upsert({ where, create, update }) {
        const existing = permissions.get(where.key);
        if (existing) {
          existing.description = update.description;
          return { id: existing.id, key: existing.key };
        }
        const row = {
          id: nextId(),
          key: create.key,
          description: create.description,
        };
        permissions.set(row.key, row);
        return { id: row.id, key: row.key };
      },
    },
    rolePermission: {
      async upsert({ where, create }) {
        const key = `${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`;
        if (!rolePermissions.has(key)) {
          rolePermissions.add(`${create.roleId}:${create.permissionId}`);
        }
        return {};
      },
    },
    user: {
      async findUnique({ where }) {
        const row = users.get(where.email);
        return row ? { id: row.id, email: row.email } : null;
      },
      async create({ data }) {
        const row = { id: nextId(), email: data.email, passwordHash: data.passwordHash };
        users.set(row.email, row);
        return { id: row.id, email: row.email };
      },
    },
    userRole: {
      async upsert({ where, create }) {
        const key = `${where.userId_roleId.userId}:${where.userId_roleId.roleId}`;
        if (!userRoles.has(key)) {
          userRoles.add(`${create.userId}:${create.roleId}`);
        }
        return {};
      },
    },
    snapshot() {
      return {
        roles: [...roles.keys()],
        permissions: [...permissions.keys()],
        rolePermissions: rolePermissions.size,
        users: [...users.keys()],
        userRoles: userRoles.size,
      };
    },
  };
}

describe('seedAuth', () => {
  it('seeds admin role and permissions idempotently', async () => {
    const store = createMemoryStore();

    const first = await seedAuth(store);
    const second = await seedAuth(store);

    expect(first.roleName).toBe(DEFAULT_ADMIN_ROLE_NAME);
    expect(first.permissionKeys).toHaveLength(DEFAULT_PERMISSIONS.length);
    expect(first.adminSkippedReason).toBe('env_unset');
    expect(second.permissionKeys).toEqual(first.permissionKeys);

    const snap = store.snapshot();
    expect(snap.roles).toEqual([DEFAULT_ADMIN_ROLE_NAME]);
    expect(snap.permissions).toHaveLength(DEFAULT_PERMISSIONS.length);
    expect(snap.rolePermissions).toBe(DEFAULT_PERMISSIONS.length);
    expect(snap.users).toHaveLength(0);
  });

  it('creates optional admin user once when email and password are set', async () => {
    const store = createMemoryStore();
    const admin = { email: 'admin@example.com', password: 'local-only-secret' };

    const first = await seedAuth(store, admin);
    const second = await seedAuth(store, admin);

    expect(first.adminUserCreated).toBe(true);
    expect(first.adminUserLinked).toBe(true);
    expect(second.adminUserCreated).toBe(false);
    expect(second.adminUserLinked).toBe(true);

    const snap = store.snapshot();
    expect(snap.users).toEqual(['admin@example.com']);
    expect(snap.userRoles).toBe(1);
  });

  it('skips admin user when only one of email/password is set', async () => {
    const store = createMemoryStore();
    const result = await seedAuth(store, { email: 'admin@example.com' });
    expect(result.adminSkippedReason).toBe('env_incomplete');
    expect(store.snapshot().users).toHaveLength(0);
  });
});
