import { BadRequestException } from '@nestjs/common';

import type { StoreContextRef } from '../stores/public';
import type { StoreService } from '../stores/public';

/**
 * Normalize optional store UUID input (empty → undefined).
 */
export function normalizeStoreId(
  value: string | null | undefined,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve store id from request context (id preferred; code via StoreService).
 */
export async function resolveContextStoreId(
  stores: StoreService,
  context?: StoreContextRef | null,
): Promise<string | undefined> {
  const fromId = normalizeStoreId(context?.storeId);
  if (fromId) {
    return fromId;
  }
  const code = context?.storeCode?.trim();
  if (!code) {
    return undefined;
  }
  const store = await stores.findByCode(code);
  return store.id;
}

/**
 * Resolve which store a cart/order should bind to.
 * Precedence: explicit input → request context storeId/code → default store.
 */
export async function resolveCartStoreId(input: {
  stores: StoreService;
  inputStoreId?: string | null;
  context?: StoreContextRef | null;
}): Promise<string> {
  const fromInput = normalizeStoreId(input.inputStoreId);
  if (fromInput) {
    return fromInput;
  }
  const fromContext = await resolveContextStoreId(
    input.stores,
    input.context,
  );
  if (fromContext) {
    return fromContext;
  }
  const defaultStore = await input.stores.findDefault();
  if (defaultStore) {
    return defaultStore.id;
  }
  throw new BadRequestException(
    'storeId is required (pass CreateCartInput.storeId, x-opoha-store-id / x-opoha-store-code, or configure a default store)',
  );
}

/**
 * Ensure request store context (when present) matches the cart/order store.
 */
export function assertStoreContextMatchesCart(input: {
  cartStoreId: string;
  contextStoreId?: string | null;
}): void {
  const contextStoreId = normalizeStoreId(input.contextStoreId);
  if (!contextStoreId) {
    return;
  }
  if (contextStoreId !== input.cartStoreId) {
    throw new BadRequestException(
      `Store context ${contextStoreId} does not match cart store ${input.cartStoreId}`,
    );
  }
}

/**
 * Product catalog visibility for a store: shared (null) or owned by that store.
 */
export function isProductVisibleInStore(
  productStoreId: string | null | undefined,
  cartStoreId: string,
): boolean {
  if (productStoreId === null || productStoreId === undefined) {
    return true;
  }
  return productStoreId === cartStoreId;
}

/**
 * Load store and reject inactive channels.
 */
export async function requireActiveStore(
  stores: StoreService,
  storeId: string,
): Promise<void> {
  const store = await stores.findById(storeId);
  if (!store.isActive) {
    throw new BadRequestException(`Store ${storeId} is not active`);
  }
}
