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

  beforeEach(() => {
    products = new Map();
    variantsByProduct = new Map();
    const productRepo = createProductRepo(products);
    productRepo.findOne = vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = products.get(where.id);
      if (!row) return null;
      return {
        ...row,
        variants: variantsByProduct.get(where.id) ?? [],
      };
    });
    productRepo.find = vi.fn(async () =>
      [...products.values()].map((row) => ({
        ...row,
        variants: variantsByProduct.get(row.id) ?? [],
      })),
    );
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
    expect(created.variants).toHaveLength(1);
    expect(created.variants?.[0]?.sku).toBe('TEE-S');
    expect(created.variants?.[0]?.priceMinor).toBe('1999');
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
    const updated = await service.update(created.id, { name: 'Cap' });
    expect(updated.name).toBe('Cap');

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toThrow(/not found/);
  });
});
