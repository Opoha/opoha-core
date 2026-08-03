import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryTranslationEntity } from '../entities/category-translation.entity';
import type { ProductTranslationEntity } from '../entities/product-translation.entity';
import { CatalogTranslationsService } from './catalog-translations.service';
import {
  parseAcceptLanguageHeader,
  resolveLocalePreference,
} from './locale';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-08-04T00:00:00Z');

describe('locale helpers', () => {
  it('parses Accept-Language primary tag', () => {
    expect(parseAcceptLanguageHeader('th-TH,th;q=0.9,en;q=0.8')).toBe('th-TH');
    expect(parseAcceptLanguageHeader('en_US')).toBe('en-US');
    expect(parseAcceptLanguageHeader('*')).toBeNull();
    expect(parseAcceptLanguageHeader(undefined)).toBeNull();
  });

  it('prefers locale arg over Accept-Language', () => {
    expect(
      resolveLocalePreference({
        localeArg: 'ja-JP',
        headers: { 'accept-language': 'th-TH' },
      }),
    ).toBe('ja-JP');
    expect(
      resolveLocalePreference({
        headers: { 'accept-language': 'th-TH,en;q=0.8' },
      }),
    ).toBe('th-TH');
  });

  it('rejects invalid locale arg', () => {
    expect(() =>
      resolveLocalePreference({ localeArg: 'ENGLISH' }),
    ).toThrow(BadRequestException);
  });
});

describe('CatalogTranslationsService (unit)', () => {
  let productRows: ProductTranslationEntity[];
  let categoryRows: CategoryTranslationEntity[];
  let service: CatalogTranslationsService;
  let productTranslations: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let categoryTranslations: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let products: { findOne: ReturnType<typeof vi.fn> };
  let categories: { findOne: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    productRows = [];
    categoryRows = [];
    const idsFrom = (op: unknown): string[] | undefined => {
      if (typeof op === 'string') return [op];
      if (op && typeof op === 'object' && 'value' in op) {
        const value = (op as { value: unknown }).value;
        return Array.isArray(value) ? (value as string[]) : undefined;
      }
      return undefined;
    };

    productTranslations = {
      find: vi.fn(async ({ where }: { where: { productId?: unknown; locale?: string } }) => {
        const ids = idsFrom(where.productId);
        return productRows.filter((r) => {
          if (ids && !ids.includes(r.productId)) return false;
          if (where.locale && r.locale !== where.locale) return false;
          return true;
        });
      }),
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: { productId: string; locale: string };
        }) => {
          return (
            productRows.find(
              (r) =>
                r.productId === where.productId && r.locale === where.locale,
            ) ?? null
          );
        },
      ),
      create: vi.fn((data: Partial<ProductTranslationEntity>) => ({
        id: '',
        createdAt: now,
        updatedAt: now,
        slug: null,
        description: null,
        ...data,
      })),
      save: vi.fn(async (row: ProductTranslationEntity) => {
        if (!row.id) {
          row.id = `pt-${productRows.length + 1}`;
        }
        const idx = productRows.findIndex((r) => r.id === row.id);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          productRows[idx] = saved;
        } else {
          productRows.push(saved);
        }
        return saved;
      }),
      delete: vi.fn(
        async ({
          productId,
          locale,
        }: {
          productId: string;
          locale: string;
        }) => {
          const before = productRows.length;
          productRows = productRows.filter(
            (r) => !(r.productId === productId && r.locale === locale),
          );
          return { affected: before - productRows.length };
        },
      ),
    };
    categoryTranslations = {
      find: vi.fn(async ({ where }: { where: { categoryId?: unknown; locale?: string } }) => {
        const ids = idsFrom(where.categoryId);
        return categoryRows.filter((r) => {
          if (ids && !ids.includes(r.categoryId)) return false;
          if (where.locale && r.locale !== where.locale) return false;
          return true;
        });
      }),
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: { categoryId: string; locale: string };
        }) => {
          return (
            categoryRows.find(
              (r) =>
                r.categoryId === where.categoryId && r.locale === where.locale,
            ) ?? null
          );
        },
      ),
      create: vi.fn((data: Partial<CategoryTranslationEntity>) => ({
        id: '',
        createdAt: now,
        updatedAt: now,
        slug: null,
        description: null,
        ...data,
      })),
      save: vi.fn(async (row: CategoryTranslationEntity) => {
        if (!row.id) {
          row.id = `ct-${categoryRows.length + 1}`;
        }
        const idx = categoryRows.findIndex((r) => r.id === row.id);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          categoryRows[idx] = saved;
        } else {
          categoryRows.push(saved);
        }
        return saved;
      }),
      delete: vi.fn(
        async ({
          categoryId,
          locale,
        }: {
          categoryId: string;
          locale: string;
        }) => {
          const before = categoryRows.length;
          categoryRows = categoryRows.filter(
            (r) => !(r.categoryId === categoryId && r.locale === locale),
          );
          return { affected: before - categoryRows.length };
        },
      ),
    };
    products = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== PRODUCT_ID) return null;
        return { id: PRODUCT_ID };
      }),
    };
    categories = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== CATEGORY_ID) return null;
        return { id: CATEGORY_ID };
      }),
    };
    service = new CatalogTranslationsService(
      productTranslations as never,
      categoryTranslations as never,
      products as never,
      categories as never,
    );
  });

  it('upserts product translation and overlays locale fields', async () => {
    const saved = await service.upsertProductTranslation({
      productId: PRODUCT_ID,
      locale: 'th-TH',
      name: 'วิดเจ็ต',
      slug: 'widget-th',
      description: 'คำอธิบาย',
    });
    expect(saved.locale).toBe('th-TH');
    expect(saved.name).toBe('วิดเจ็ต');
    expect(productRows).toHaveLength(1);

    const base = {
      id: PRODUCT_ID,
      name: 'Widget',
      slug: 'widget',
      description: 'English desc',
      isActive: true,
      fulfillmentMode: 'physical',
      storeId: null,
      vendorId: null,
      createdAt: now,
      updatedAt: now,
    };
    const localized = await service.applyProductLocale(base, 'th-TH');
    expect(localized.name).toBe('วิดเจ็ต');
    expect(localized.slug).toBe('widget-th');
    expect(localized.description).toBe('คำอธิบาย');

    const fallback = await service.applyProductLocale(base, 'ja-JP');
    expect(fallback.name).toBe('Widget');
  });

  it('falls back slug/description when translation leaves them null', async () => {
    await service.upsertProductTranslation({
      productId: PRODUCT_ID,
      locale: 'th-TH',
      name: 'สินค้า',
    });
    const localized = await service.applyProductLocale(
      {
        id: PRODUCT_ID,
        name: 'Widget',
        slug: 'widget',
        description: 'Base',
        isActive: true,
        fulfillmentMode: 'physical',
        storeId: null,
        vendorId: null,
        createdAt: now,
        updatedAt: now,
      },
      'th-TH',
    );
    expect(localized.name).toBe('สินค้า');
    expect(localized.slug).toBe('widget');
    expect(localized.description).toBe('Base');
  });

  it('upserts category translation and batch-overlays', async () => {
    await service.upsertCategoryTranslation({
      categoryId: CATEGORY_ID,
      locale: 'th-TH',
      name: 'หมวดหมู่',
      slug: 'cat-th',
    });
    const list = await service.applyCategoryLocaleMany(
      [
        {
          id: CATEGORY_ID,
          name: 'Category',
          slug: 'cat',
          description: null,
          parentId: null,
          sortOrder: 0,
          isActive: true,
          storeId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      'th-TH',
    );
    expect(list[0]?.name).toBe('หมวดหมู่');
    expect(list[0]?.slug).toBe('cat-th');
  });

  it('rejects unknown product / invalid locale / empty name', async () => {
    await expect(
      service.upsertProductTranslation({
        productId: '99999999-9999-4999-8999-999999999999',
        locale: 'th-TH',
        name: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.upsertProductTranslation({
        productId: PRODUCT_ID,
        locale: 'bad',
        name: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upsertProductTranslation({
        productId: PRODUCT_ID,
        locale: 'th-TH',
        name: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes translations', async () => {
    await service.upsertProductTranslation({
      productId: PRODUCT_ID,
      locale: 'th-TH',
      name: 'x',
    });
    expect(await service.deleteProductTranslation(PRODUCT_ID, 'th-TH')).toBe(
      true,
    );
    expect(await service.deleteProductTranslation(PRODUCT_ID, 'th-TH')).toBe(
      false,
    );
  });
});
