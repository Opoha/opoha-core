import { describe, expect, it, vi } from 'vitest';

import { AuthResolver } from './auth.resolver';

describe('AuthResolver (G-05 myPermissions)', () => {
  it('returns API-key scoped permissions when present on AuthUser', async () => {
    const permissionsService = {
      listKeysForUser: vi.fn(),
    };
    const resolver = new AuthResolver({} as never, {} as never, permissionsService as never);

    await expect(
      resolver.myPermissions({
        userId: 'u1',
        email: 'staff@example.com',
        permissions: ['giftcard:read', 'search:read'],
      }),
    ).resolves.toEqual(['giftcard:read', 'search:read']);
    expect(permissionsService.listKeysForUser).not.toHaveBeenCalled();
  });

  it('loads role-derived keys when AuthUser has no scoped permissions', async () => {
    const permissionsService = {
      listKeysForUser: vi.fn().mockResolvedValue(['segment:read', 'loyalty:read']),
    };
    const resolver = new AuthResolver({} as never, {} as never, permissionsService as never);

    await expect(
      resolver.myPermissions({
        userId: 'u1',
        email: 'staff@example.com',
      }),
    ).resolves.toEqual(['segment:read', 'loyalty:read']);
    expect(permissionsService.listKeysForUser).toHaveBeenCalledWith('u1');
  });
});
