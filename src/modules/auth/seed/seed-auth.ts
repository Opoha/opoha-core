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
  { key: 'audit:read', description: 'Read audit / activity logs' },
  {
    key: 'report:read',
    description: 'Read operational reports (orders, inventory, fulfillment)',
  },
  {
    key: 'bulk:product',
    description: 'Run bulk product update operations',
  },
  {
    key: 'bulk:inventory',
    description: 'Run bulk inventory adjustment operations',
  },
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
  { key: 'attribute:create', description: 'Create catalog attribute definitions' },
  { key: 'attribute:read', description: 'Read catalog attributes' },
  { key: 'attribute:update', description: 'Update catalog attributes and values' },
  { key: 'attribute:delete', description: 'Delete catalog attributes and values' },
  { key: 'product-media:create', description: 'Attach media files to products' },
  { key: 'product-media:read', description: 'Read product media links' },
  { key: 'product-media:update', description: 'Update product media links' },
  { key: 'product-media:delete', description: 'Detach product media links' },
  { key: 'inventory:create', description: 'Create inventory items for variants' },
  { key: 'inventory:read', description: 'Read inventory stock levels' },
  { key: 'inventory:adjust', description: 'Adjust inventory on-hand quantities' },
  { key: 'inventory:reserve', description: 'Reserve inventory stock' },
  { key: 'inventory:release', description: 'Release inventory reservations' },
  {
    key: 'inventory:transfer',
    description: 'Create, ship, receive, or cancel stock transfers between warehouses',
  },
  { key: 'warehouse:create', description: 'Create warehouses / inventory locations' },
  { key: 'warehouse:read', description: 'Read warehouses / inventory locations' },
  { key: 'warehouse:update', description: 'Update warehouses / inventory locations' },
  { key: 'warehouse:delete', description: 'Delete warehouses / inventory locations' },
  { key: 'supplier:create', description: 'Create suppliers / vendors' },
  { key: 'supplier:read', description: 'Read suppliers / vendors' },
  { key: 'supplier:update', description: 'Update suppliers / vendors' },
  { key: 'supplier:delete', description: 'Delete suppliers / vendors' },
  { key: 'purchase-order:create', description: 'Create purchase orders' },
  { key: 'purchase-order:read', description: 'Read purchase orders' },
  {
    key: 'purchase-order:receive',
    description: 'Receive purchase orders into warehouse stock',
  },
  { key: 'purchase-order:cancel', description: 'Cancel draft purchase orders' },
  { key: 'fulfillment:read', description: 'Read fulfillments and shipments' },
  { key: 'fulfillment:create', description: 'Create fulfillments' },
  { key: 'fulfillment:pick', description: 'Mark fulfillments as picked' },
  { key: 'fulfillment:pack', description: 'Mark fulfillments as packed' },
  {
    key: 'fulfillment:ship',
    description: 'Ship fulfillments (including label orchestration)',
  },
  {
    key: 'fulfillment:cancel',
    description: 'Cancel pending or picked fulfillments',
  },
  { key: 'return:read', description: 'Read returns / RMAs' },
  { key: 'return:create', description: 'Create returns / RMAs' },
  { key: 'return:approve', description: 'Approve requested returns / RMAs' },
  {
    key: 'return:receive',
    description: 'Mark returns / RMAs received and restock inventory',
  },
  {
    key: 'return:refund',
    description: 'Complete a refund-resolution return via the payment engine',
  },
  {
    key: 'return:exchange',
    description: 'Complete an exchange-resolution return (replacement order stub)',
  },
  { key: 'return:cancel', description: 'Cancel requested or approved returns / RMAs' },
  { key: 'customer:create', description: 'Create customer accounts (staff)' },
  { key: 'customer:read', description: 'Read customer accounts' },
  { key: 'customer:update', description: 'Update customer profiles' },
  { key: 'customer:delete', description: 'Delete customer accounts' },
  { key: 'customer-group:create', description: 'Create customer groups' },
  { key: 'customer-group:read', description: 'Read customer groups' },
  { key: 'customer-group:update', description: 'Update customer groups and membership' },
  { key: 'customer-group:delete', description: 'Delete customer groups' },
  { key: 'cart:create', description: 'Create shopping carts' },
  { key: 'cart:read', description: 'Read shopping carts' },
  { key: 'cart:update', description: 'Add, update, or remove cart lines' },
  { key: 'cart:delete', description: 'Delete shopping carts' },
  { key: 'cart:checkout', description: 'Prepare checkout (reserve stock + totals)' },
  { key: 'order:create', description: 'Create orders (place order)' },
  { key: 'order:read', description: 'Read orders' },
  { key: 'order:update', description: 'Update order status and details' },
  { key: 'payment:read', description: 'Read payments and provider status' },
  {
    key: 'payment:authorize',
    description: 'Authorize a new payment against an order',
  },
  { key: 'payment:capture', description: 'Capture an authorized payment' },
  { key: 'payment:refund', description: 'Refund a captured payment' },
  {
    key: 'shipping:read',
    description: 'List shipping methods and quote rates',
  },
  { key: 'tax:read', description: 'Read tax classes, rules, and providers' },
  { key: 'tax:create', description: 'Create tax classes and rules' },
  { key: 'tax:update', description: 'Update tax classes and rules' },
  { key: 'tax:delete', description: 'Delete tax classes and rules' },
  {
    key: 'promotion:read',
    description: 'Read coupons, discount rules, and promotion providers',
  },
  {
    key: 'promotion:create',
    description: 'Create coupons and discount rules',
  },
  {
    key: 'promotion:update',
    description: 'Update coupons and discount rules',
  },
  {
    key: 'promotion:delete',
    description: 'Delete coupons and discount rules',
  },
  {
    key: 'notification:read',
    description: 'Read notification providers and transactional templates',
  },
  {
    key: 'search:read',
    description: 'Read search providers and run product search queries',
  },
  {
    key: 'search:configure',
    description: 'Configure search providers and index settings',
  },
  { key: 'giftcard:read', description: 'Read gift cards and quote redeem' },
  { key: 'giftcard:issue', description: 'Issue gift cards (staff)' },
  {
    key: 'giftcard:purchase',
    description: 'Purchase / issue gift cards linked to orders',
  },
  { key: 'giftcard:redeem', description: 'Redeem gift card balances' },
  { key: 'loyalty:read', description: 'Read loyalty accounts and quote redeem' },
  { key: 'loyalty:accrue', description: 'Accrue / credit loyalty points' },
  { key: 'loyalty:redeem', description: 'Redeem loyalty points' },
  { key: 'segment:read', description: 'Read customer segments and evaluate membership' },
  { key: 'segment:create', description: 'Create customer segments' },
  { key: 'segment:update', description: 'Update customer segments' },
  { key: 'segment:delete', description: 'Delete customer segments' },
  { key: 'store:create', description: 'Create application stores / brands' },
  { key: 'store:read', description: 'Read application stores / brands' },
  { key: 'store:update', description: 'Update application stores / brands' },
  { key: 'store:delete', description: 'Delete application stores / brands' },
  {
    key: 'settings:read',
    description: 'Read store-scoped channel / configuration settings',
  },
  {
    key: 'settings:update',
    description: 'Update store-scoped channel / configuration settings',
  },
  {
    key: 'currency:read',
    description:
      'Read store display/settlement currency configuration and exchange rates',
  },
  {
    key: 'currency:update',
    description:
      'Update store currency configuration and manual exchange rates',
  },
  {
    key: 'localization:read',
    description: 'Read deployment localization settings',
  },
  {
    key: 'localization:update',
    description: 'Update deployment localization settings',
  },
  {
    key: 'translation:read',
    description: 'Read catalog product/category locale translations',
  },
  {
    key: 'translation:update',
    description: 'Create, update, or delete catalog locale translations',
  },
  {
    key: 'b2b:read',
    description: 'Read B2B companies, memberships, price lists, and quotes',
  },
  {
    key: 'b2b:create',
    description: 'Create B2B companies and buyer quotes',
  },
  {
    key: 'b2b:update',
    description:
      'Update B2B companies, memberships, price lists, and quote status',
  },
  {
    key: 'b2b:delete',
    description: 'Remove B2B company memberships',
  },
  {
    key: 'b2b:approve',
    description: 'Approve draft B2B orders and confirm approved B2B orders',
  },
  {
    key: 'b2b:convert',
    description: 'Convert accepted B2B quotes to draft orders',
  },
  { key: 'vendor:create', description: 'Create marketplace vendor accounts' },
  { key: 'vendor:read', description: 'Read marketplace vendor accounts' },
  { key: 'vendor:update', description: 'Update marketplace vendors and product assignment' },
  { key: 'vendor:delete', description: 'Delete marketplace vendor accounts' },
  {
    key: 'digital:read',
    description: 'Read digital download tokens and license keys',
  },
  {
    key: 'digital:issue',
    description: 'Issue digital download tokens and license keys',
  },
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
