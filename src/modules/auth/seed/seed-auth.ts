import { hashPassword } from './password';

/** Default staff admin role name (idempotent upsert key). */
export const DEFAULT_ADMIN_ROLE_NAME = 'admin' as const;

/** Baseline MVP permission keys (`resource:action`). */
export const DEFAULT_PERMISSIONS = [
  { key: 'user:create', description: 'Create staff users' },
  { key: 'user:read', description: 'Read staff users' },
  { key: 'user:update', description: 'Update staff users' },
  { key: 'user:delete', description: 'Delete staff users' },
  { key: 'role:create', description: 'Create roles' },
  { key: 'role:read', description: 'Read roles' },
  { key: 'role:update', description: 'Update roles' },
  { key: 'role:delete', description: 'Delete roles' },
  { key: 'permission:read', description: 'Read permissions' },
  { key: 'api-key:create', description: 'Create API keys' },
  { key: 'api-key:read', description: 'Read API keys' },
  { key: 'api-key:revoke', description: 'Revoke API keys' },
  { key: 'audit:read', description: 'Read audit logs' },
  { key: 'plugin:read', description: 'Read plugin status and admin extension manifests' },
  { key: 'plugin:manage', description: 'Install, enable, disable, and uninstall plugins' },
  { key: 'product:create', description: 'Create catalog products' },
  { key: 'product:read', description: 'Read catalog products' },
  { key: 'product:update', description: 'Update catalog products' },
  { key: 'product:delete', description: 'Delete catalog products' },
  { key: 'category:create', description: 'Create catalog categories' },
  { key: 'category:read', description: 'Read catalog categories' },
  { key: 'category:update', description: 'Update catalog categories' },
  { key: 'category:delete', description: 'Delete catalog categories' },
  { key: 'collection:create', description: 'Create catalog collections' },
  { key: 'collection:read', description: 'Read catalog collections' },
  { key: 'collection:update', description: 'Update catalog collections' },
  { key: 'collection:delete', description: 'Delete catalog collections' },
  { key: 'brand:create', description: 'Create catalog brands' },
  { key: 'brand:read', description: 'Read catalog brands' },
  { key: 'brand:update', description: 'Update catalog brands' },
  { key: 'brand:delete', description: 'Delete catalog brands' },
] as const;

export type SeedAdminOptions = {
  email?: string;
  password?: string;
};

export type SeedAuthResult = {
  roleName: string;
  permissionKeys: string[];
  adminUserCreated: boolean;
  adminUserLinked: boolean;
  adminSkippedReason?: 'env_unset' | 'env_incomplete';
};

/** Minimal persistence surface for seed (keeps unit tests DB-free). */
export type SeedAuthStore = {
  role: {
    upsert: (args: {
      where: { name: string };
      create: { name: string; description: string };
      update: { description: string };
    }) => Promise<{ id: string; name: string }>;
  };
  permission: {
    upsert: (args: {
      where: { key: string };
      create: { key: string; description: string };
      update: { description: string };
    }) => Promise<{ id: string; key: string }>;
  };
  rolePermission: {
    upsert: (args: {
      where: { roleId_permissionId: { roleId: string; permissionId: string } };
      create: { roleId: string; permissionId: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
  user: {
    findUnique: (args: {
      where: { email: string };
    }) => Promise<{ id: string; email: string } | null>;
    create: (args: {
      data: { email: string; passwordHash: string };
    }) => Promise<{ id: string; email: string }>;
  };
  userRole: {
    upsert: (args: {
      where: { userId_roleId: { userId: string; roleId: string } };
      create: { userId: string; roleId: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
};

/**
 * Idempotently seed the default admin role, baseline permissions, and role↔permission links.
 * When both `admin.email` and `admin.password` are provided, also ensure an admin user + role link.
 */
export async function seedAuth(
  store: SeedAuthStore,
  admin: SeedAdminOptions = {},
): Promise<SeedAuthResult> {
  const role = await store.role.upsert({
    where: { name: DEFAULT_ADMIN_ROLE_NAME },
    create: {
      name: DEFAULT_ADMIN_ROLE_NAME,
      description: 'Default staff administrator',
    },
    update: {
      description: 'Default staff administrator',
    },
  });

  const permissionKeys: string[] = [];
  for (const permission of DEFAULT_PERMISSIONS) {
    const row = await store.permission.upsert({
      where: { key: permission.key },
      create: {
        key: permission.key,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionKeys.push(row.key);
    await store.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: row.id },
      },
      create: { roleId: role.id, permissionId: row.id },
      update: {},
    });
  }

  const email = admin.email?.trim();
  const password = admin.password;
  if (!email && !password) {
    return {
      roleName: role.name,
      permissionKeys,
      adminUserCreated: false,
      adminUserLinked: false,
      adminSkippedReason: 'env_unset',
    };
  }
  if (!email || !password) {
    return {
      roleName: role.name,
      permissionKeys,
      adminUserCreated: false,
      adminUserLinked: false,
      adminSkippedReason: 'env_incomplete',
    };
  }

  const existing = await store.user.findUnique({ where: { email } });
  let userId: string;
  let adminUserCreated = false;
  if (existing) {
    userId = existing.id;
  } else {
    const created = await store.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
      },
    });
    userId = created.id;
    adminUserCreated = true;
  }

  await store.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });

  return {
    roleName: role.name,
    permissionKeys,
    adminUserCreated,
    adminUserLinked: true,
  };
}

/**
 * Resolve optional admin credentials from process env.
 * Both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` must be set to create a user.
 */
export function resolveSeedAdminFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SeedAdminOptions {
  return {
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
  };
}
