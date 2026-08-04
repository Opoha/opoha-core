import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  assertStoreContextMatchesCart,
  isProductVisibleInStore,
  normalizeStoreId,
  requireActiveStore,
  resolveCartStoreId,
  resolveContextStoreId,
} from './store-scope';

describe('order store-scope helpers', () => {
  it('normalizeStoreId trims and drops empty', () => {
    expect(normalizeStoreId('  abc  ')).toBe('abc');
    expect(normalizeStoreId('')).toBeUndefined();
    expect(normalizeStoreId(null)).toBeUndefined();
  });

  it('isProductVisibleInStore allows shared and same-store owned', () => {
    expect(isProductVisibleInStore(null, 'store-a')).toBe(true);
    expect(isProductVisibleInStore('store-a', 'store-a')).toBe(true);
    expect(isProductVisibleInStore('store-b', 'store-a')).toBe(false);
  });

  it('assertStoreContextMatchesCart ignores missing context', () => {
    expect(() =>
      assertStoreContextMatchesCart({
        cartStoreId: 'store-a',
        contextStoreId: undefined,
      }),
    ).not.toThrow();
  });

  it('assertStoreContextMatchesCart rejects mismatch', () => {
    expect(() =>
      assertStoreContextMatchesCart({
        cartStoreId: 'store-a',
        contextStoreId: 'store-b',
      }),
    ).toThrow(BadRequestException);
  });

  it('resolveCartStoreId prefers input over context over default', async () => {
    const stores = {
      findByCode: vi.fn(),
      findDefault: vi.fn(async () => ({ id: 'default-store' })),
    };

    await expect(
      resolveCartStoreId({
        stores: stores as never,
        inputStoreId: 'input-store',
        context: { storeId: 'ctx-store', source: 'header' },
      }),
    ).resolves.toBe('input-store');

    await expect(
      resolveCartStoreId({
        stores: stores as never,
        context: { storeId: 'ctx-store', source: 'header' },
      }),
    ).resolves.toBe('ctx-store');

    await expect(resolveCartStoreId({ stores: stores as never })).resolves.toBe('default-store');
  });

  it('resolveContextStoreId resolves store code via StoreService', async () => {
    const stores = {
      findByCode: vi.fn(async () => ({ id: 'from-code' })),
    };
    await expect(
      resolveContextStoreId(stores as never, {
        storeCode: 'MAIN',
        source: 'header',
      }),
    ).resolves.toBe('from-code');
    expect(stores.findByCode).toHaveBeenCalledWith('MAIN');
  });

  it('requireActiveStore rejects inactive stores', async () => {
    const stores = {
      findById: vi.fn(async () => ({
        id: 'store-a',
        isActive: false,
      })),
    };
    await expect(requireActiveStore(stores as never, 'store-a')).rejects.toThrow(
      BadRequestException,
    );
  });
});
