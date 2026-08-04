import { IsNull, type FindOptionsWhere } from 'typeorm';

import type { StoreCatalogMode } from '../config/public';

/**
 * Build TypeORM `where` for store-scoped catalog listing (Phase 5 B-04).
 *
 * - No store → global/admin list (undefined where).
 * - `shared` (default) → shared rows (`storeId` null) ∪ store-owned for scope.
 * - `isolated` → store-owned rows only for scope.
 */
export function catalogStoreWhere<T extends { storeId: string | null }>(
  storeId: string | null | undefined,
  catalogMode: StoreCatalogMode = 'shared',
): FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined {
  if (storeId === undefined || storeId === null || storeId.trim() === '') {
    return undefined;
  }
  const scope = storeId.trim();
  if (catalogMode === 'isolated') {
    return { storeId: scope } as FindOptionsWhere<T>;
  }
  return [{ storeId: IsNull() } as FindOptionsWhere<T>, { storeId: scope } as FindOptionsWhere<T>];
}
