import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContributionRegistry } from '../plugin-loader/public';
import { CategoriesResolver } from './categories/categories.resolver';
import { CategoriesService } from './categories/categories.service';
import type { CategoryEntity } from './entities/category.entity';
import type { ProductVariantEntity } from './entities/product-variant.entity';
import type { ProductEntity } from './entities/product.entity';
import { ProductsResolver } from './products/products.resolver';
import { ProductsService } from './products/products.service';
import { catalogStoreWhere } from './store-catalog-scope';

const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function matchStoreWhere(rowStoreId: string | null, where: unknown): boolean {
  const clauses = Array.isArray(where) ? where : where ? [where] : [];
  if (clauses.length === 0) {
    return true;
  }
  return clauses.some((clause: { storeId?: unknown }) => {
    const op = clause.storeId;
    if (
      typeof op === 'object' &&
      op !== null &&
      'type' in op &&
      (op as { type: string }).type === 'isNull'
    ) {
      return rowStoreId === null;
    }
    return rowStoreId === op;
  });
}

/**
 * Phase 5 B-04 — two-store isolated vs shared catalog GraphQL/service scenarios.
 */
describe('multi-store catalog (B-04)', () => {
  describe('catalogStoreWhere helper', () => {
    it('returns undefined for global listing', () => {
      expect(catalogStoreWhere(undefined)).toBeUndefined();
      expect(catalogStoreWhere(null)).toBeUndefined();
      expect(catalogStoreWhere('')).toBeUndefined();
    });

    it('builds shared ∪ owned OR clauses by default', () => {
      const where = catalogStoreWhere(STORE_A);
      expect(Array.isArray(where)).toBe(true);
      expect(where).toHaveLength(2);
    });

    it('builds owned-only where for isolated mode', () => {
      expect(catalogStoreWhere(STORE_A, 'isolated')).toEqual({
        storeId: STORE_A,
      });
    });
  });

  describe('two stores — products + categories', () => {
    let products: Map<string, ProductEntity>;
    let variantsByProduct: Map<string, ProductVariantEntity[]>;
    let categories: Map<string, CategoryEntity>;
    let productsService: ProductsService;
    let categoriesService: CategoriesService;
    let productsResolver: ProductsResolver;
    let categoriesResolver: CategoriesResolver;
    let channelModes: Record<string, 'shared' | 'isolated'>;

    beforeEach(() => {
      products = new Map();
      variantsByProduct = new Map();
      categories = new Map();
      channelModes = {
        [STORE_A]: 'shared',
        [STORE_B]: 'isolated',
      };

      const productRepo = {
        create: vi.fn((data: Partial<ProductEntity>) => ({ ...data }) as ProductEntity),
        save: vi.fn(async (row: ProductEntity) => {
          if (!row.id) {
            row.id = `prod-${products.size + 1}`;
            row.createdAt = new Date('2026-08-03T00:00:00Z');
            row.updatedAt = row.createdAt;
          }
          products.set(row.id, { ...row, variants: row.variants ?? [] });
          return products.get(row.id)!;
        }),
        find: vi.fn(async (opts?: { where?: unknown }) => {
          return [...products.values()]
            .filter((row) => matchStoreWhere(row.storeId ?? null, opts?.where))
            .map((row) => ({
              ...row,
              variants: variantsByProduct.get(row.id) ?? [],
            }));
        }),
        findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = products.get(where.id);
          if (!row) return null;
          return {
            ...row,
            variants: variantsByProduct.get(where.id) ?? [],
          };
        }),
        delete: vi.fn(),
      };

      const variantRepo = {
        create: vi.fn(
          (data: Partial<ProductVariantEntity>) => ({ ...data }) as ProductVariantEntity,
        ),
        save: vi.fn(async (rows: ProductVariantEntity | ProductVariantEntity[]) => {
          const list = Array.isArray(rows) ? rows : [rows];
          for (const row of list) {
            if (!row.id) {
              row.id = `var-${Math.random().toString(36).slice(2, 8)}`;
              row.createdAt = new Date('2026-08-03T00:00:00Z');
              row.updatedAt = row.createdAt;
            }
            const bucket = variantsByProduct.get(row.productId) ?? [];
            bucket.push(row);
            variantsByProduct.set(row.productId, bucket);
          }
          return list;
        }),
      };

      const categoryRepo = {
        create: vi.fn((data: Partial<CategoryEntity>) => ({ ...data }) as CategoryEntity),
        save: vi.fn(async (row: CategoryEntity) => {
          if (!row.id) {
            row.id = `cat-${categories.size + 1}`;
            row.createdAt = new Date('2026-08-03T00:00:00Z');
            row.updatedAt = row.createdAt;
          }
          categories.set(row.id, { ...row });
          return categories.get(row.id)!;
        }),
        find: vi.fn(async (opts?: { where?: unknown }) => {
          return [...categories.values()].filter((row) =>
            matchStoreWhere(row.storeId ?? null, opts?.where),
          );
        }),
        findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
          return categories.get(where.id) ?? null;
        }),
        delete: vi.fn(),
      };

      const channelSettings = {
        getForStore: vi.fn(async (storeId: string) => ({
          storeId,
          catalogMode: channelModes[storeId] ?? 'shared',
        })),
      };

      productsService = new ProductsService(
        productRepo as never,
        variantRepo as never,
        undefined,
        channelSettings as never,
      );
      categoriesService = new CategoriesService(categoryRepo as never, channelSettings as never);

      const contributions = new ContributionRegistry({
        subscribe: vi.fn(),
      } as never);
      productsResolver = new ProductsResolver(productsService, contributions);
      categoriesResolver = new CategoriesResolver(categoriesService);
    });

    async function seedCatalog() {
      await productsService.create({ name: 'Shared SKU', slug: 'shared' });
      await productsService.create({
        name: 'A Exclusive',
        slug: 'a-only',
        storeId: STORE_A,
      });
      await productsService.create({
        name: 'B Exclusive',
        slug: 'b-only',
        storeId: STORE_B,
      });
      await categoriesService.create({ name: 'Shared Cat', slug: 'shared-cat' });
      await categoriesService.create({
        name: 'A Cat',
        slug: 'a-cat',
        storeId: STORE_A,
      });
      await categoriesService.create({
        name: 'B Cat',
        slug: 'b-cat',
        storeId: STORE_B,
      });
    }

    it('shared store sees shared ∪ owned; isolated store sees owned-only (channel settings)', async () => {
      await seedCatalog();

      const forA = await productsResolver.products(STORE_A);
      expect(forA.map((p) => p.slug).sort()).toEqual(['a-only', 'shared']);

      const forB = await productsResolver.products(STORE_B);
      expect(forB.map((p) => p.slug)).toEqual(['b-only']);

      const catsA = await categoriesResolver.categories(STORE_A);
      expect(catsA.map((c) => c.slug).sort()).toEqual(['a-cat', 'shared-cat']);

      const catsB = await categoriesResolver.categories(STORE_B);
      expect(catsB.map((c) => c.slug)).toEqual(['b-cat']);
    });

    it('GraphQL catalogMode override forces isolated on a shared channel', async () => {
      await seedCatalog();

      const forced = await productsResolver.products(STORE_A, 'isolated');
      expect(forced.map((p) => p.slug)).toEqual(['a-only']);

      const cats = await categoriesResolver.categories(STORE_A, 'isolated');
      expect(cats.map((c) => c.slug)).toEqual(['a-cat']);
    });

    it('GraphQL catalogMode override forces shared on an isolated channel', async () => {
      await seedCatalog();

      const forced = await productsResolver.products(STORE_B, 'shared');
      expect(forced.map((p) => p.slug).sort()).toEqual(['b-only', 'shared']);
    });

    it('keeps store isolation — A never sees B-owned rows', async () => {
      await seedCatalog();

      for (const mode of ['shared', 'isolated'] as const) {
        const rows = await productsService.findAll(STORE_A, mode);
        expect(rows.some((p) => p.slug === 'b-only')).toBe(false);
      }
    });
  });
});
