import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductsService } from './products.service';
import type { ProductEntity } from '../entities/product.entity';
import type { ProductVariantEntity } from '../entities/product-variant.entity';

function createProductRepo(store: Map<string, ProductEntity>) {
  return {
    create: vi.fn((data: Partial<ProductEntity>) => ({ ...data }) as ProductEntity),
    save: vi.fn(async (row: ProductEntity) => {
      if (!row.id) {
        row.id = `prod-${store.size + 1}`;
        row.createdAt = new Date('2026-08-03T00:00:00Z');
        row.updatedAt = row.createdAt;
      }
      store.set(row.id, { ...row, variants: row.variants ?? [] });
      return store.get(row.id)!;
    }),
    find: vi.fn(async () => [...store.values()]),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
      return store.get(where.id) ?? null;
    }),
    delete: vi.fn(async ({ id }: { id: string }) => {
      store.delete(id);
      return { affected: 1 };
    }),
  };
}

function createVariantRepo(store: Map<string, ProductVariantEntity[]>) {
  return {
    create: vi.fn((data: Partial<ProductVariantEntity>) => ({ ...data }) as ProductVariantEntity),
    save: vi.fn(async (rows: ProductVariantEntity | ProductVariantEntity[]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const row of list) {
        if (!row.id) {
          row.id = `var-${Math.random().toString(36).slice(2, 8)}`;
          row.createdAt = new Date('2026-08-03T00:00:00Z');
          row.updatedAt = row.createdAt;
        }
        const bucket = store.get(row.productId) ?? [];
        bucket.push(row);
        store.set(row.productId, bucket);
      }
      return list;
    }),
  };
}

describe('ProductsService', () => {
  let products: Map<string, ProductEntity>;
  let variantsByProduct: Map<string, ProductVariantEntity[]>;
  let service: ProductsService;
  let productRepo: ReturnType<typeof createProductRepo>;

  beforeEach(() => {
    products = new Map();
    variantsByProduct = new Map();
    productRepo = createProductRepo(products);
    productRepo.findOne = vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = products.get(where.id);
      if (!row) return null;
      return {
        ...row,
        variants: variantsByProduct.get(where.id) ?? [],
      };
    });
    productRepo.find = vi.fn(async (opts?: { where?: unknown }) => {
      let rows = [...products.values()];
      const where = opts?.where;
      const clauses = Array.isArray(where) ? where : where ? [where] : [];
      if (clauses.length > 0) {
        rows = rows.filter((row) => {
          const sid = row.storeId ?? null;
          return clauses.some((clause: { storeId?: unknown }) => {
            const op = clause.storeId;
            if (
              typeof op === 'object' &&
              op !== null &&
              'type' in op &&
              (op as { type: string }).type === 'isNull'
            ) {
              return sid === null;
            }
            return sid === op;
          });
        });
      }
      return rows.map((row) => ({
        ...row,
        variants: variantsByProduct.get(row.id) ?? [],
      }));
    });
    service = new ProductsService(
      productRepo as never,
      createVariantRepo(variantsByProduct) as never,
    );
  });

  it('creates a product with optional variants', async () => {
    const created = await service.create({
      name: 'Tee',
      slug: 'tee',
      description: 'Soft tee',
      variants: [
        { sku: 'TEE-S', priceMinor: '1999', name: 'Small' },
      ],
    });

    expect(created.name).toBe('Tee');
    expect(created.slug).toBe('tee');
    expect(created.storeId).toBeNull();
    expect(created.variants).toHaveLength(1);
    expect(created.variants?.[0]?.sku).toBe('TEE-S');
    expect(created.variants?.[0]?.priceMinor).toBe('1999');
  });

  it('scopes findAll to shared + store-owned for a store', async () => {
    await service.create({ name: 'Shared', slug: 'shared' });
    await service.create({
      name: 'Store A',
      slug: 'a-only',
      storeId: 'store-a',
    });
    await service.create({
      name: 'Store B',
      slug: 'b-only',
      storeId: 'store-b',
    });

    const forA = await service.findAll('store-a');
    expect(forA.map((p) => p.slug).sort()).toEqual(['a-only', 'shared']);

    const all = await service.findAll();
    expect(all).toHaveLength(3);
  });

  it('scopes findAll to store-owned only when catalogMode is isolated', async () => {
    await service.create({ name: 'Shared', slug: 'shared' });
    await service.create({
      name: 'Store A',
      slug: 'a-only',
      storeId: 'store-a',
    });
    await service.create({
      name: 'Store B',
      slug: 'b-only',
      storeId: 'store-b',
    });

    const forA = await service.findAll('store-a', 'isolated');
    expect(forA.map((p) => p.slug)).toEqual(['a-only']);

    const forB = await service.findAll('store-b', 'isolated');
    expect(forB.map((p) => p.slug)).toEqual(['b-only']);
  });

  it('resolves catalogMode from channel settings when omitted', async () => {
    await service.create({ name: 'Shared', slug: 'shared' });
    await service.create({
      name: 'Store A',
      slug: 'a-only',
      storeId: 'store-a',
    });

    const channelSettings = {
      getForStore: vi.fn(async () => ({ catalogMode: 'isolated' as const })),
    };
    const scoped = new ProductsService(
      productRepo as never,
      createVariantRepo(variantsByProduct) as never,
      undefined,
      channelSettings as never,
    );

    const forA = await scoped.findAll('store-a');
    expect(channelSettings.getForStore).toHaveBeenCalledWith('store-a');
    expect(forA.map((p) => p.slug)).toEqual(['a-only']);
  });

  it('rejects non-integer priceMinor', async () => {
    await expect(
      service.create({
        name: 'Bad',
        slug: 'bad',
        variants: [{ sku: 'BAD', priceMinor: '19.99' }],
      }),
    ).rejects.toThrow(/priceMinor/);
  });

  it('updates and deletes products', async () => {
    const created = await service.create({ name: 'Hat', slug: 'hat' });
    const updated = await service.update(created.id, {
      name: 'Cap',
      storeId: 'store-a',
    });
    expect(updated.name).toBe('Cap');
    expect(updated.storeId).toBe('store-a');

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toThrow(/not found/);
  });
});
