import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';

import { CategoryEntity } from '../entities/category.entity';
import { CategoryTranslationEntity } from '../entities/category-translation.entity';
import { ProductEntity } from '../entities/product.entity';
import { ProductTranslationEntity } from '../entities/product-translation.entity';
import type { CategoryType } from '../categories/category.types';
import type { ProductType } from '../products/product.types';
import { assertLocale } from './locale';
import type {
  CategoryTranslationRecord,
  ProductTranslationRecord,
  UpsertCategoryTranslationInput,
  UpsertProductTranslationInput,
} from './catalog-translation.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function isFkViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toProductTranslation(
  row: ProductTranslationEntity,
): ProductTranslationRecord {
  return {
    id: row.id,
    productId: row.productId,
    locale: row.locale,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCategoryTranslation(
  row: CategoryTranslationEntity,
): CategoryTranslationRecord {
  return {
    id: row.id,
    categoryId: row.categoryId,
    locale: row.locale,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function overlayFields<T extends { name: string; slug: string; description: string | null }>(
  base: T,
  tr: { name: string; slug: string | null; description: string | null } | null,
): T {
  if (!tr) {
    return base;
  }
  return {
    ...base,
    name: tr.name,
    slug: tr.slug?.trim() ? tr.slug.trim() : base.slug,
    description:
      tr.description !== null && tr.description !== undefined
        ? tr.description
        : base.description,
  };
}

/**
 * Core translation storage for catalog entities (Phase 5 C-01).
 *
 * Pattern: base product/category row = default locale; translation rows hold
 * locale-specific name/slug/description. Resolve overlays for locale-aware reads.
 */
@Injectable()
export class CatalogTranslationsService {
  constructor(
    @InjectRepository(ProductTranslationEntity)
    private readonly productTranslations: Repository<ProductTranslationEntity>,
    @InjectRepository(CategoryTranslationEntity)
    private readonly categoryTranslations: Repository<CategoryTranslationEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
  ) {}

  async listProductTranslations(
    productId: string,
  ): Promise<ProductTranslationRecord[]> {
    const rows = await this.productTranslations.find({
      where: { productId },
      order: { locale: 'ASC' },
    });
    return rows.map(toProductTranslation);
  }

  async listCategoryTranslations(
    categoryId: string,
  ): Promise<CategoryTranslationRecord[]> {
    const rows = await this.categoryTranslations.find({
      where: { categoryId },
      order: { locale: 'ASC' },
    });
    return rows.map(toCategoryTranslation);
  }

  async upsertProductTranslation(
    input: UpsertProductTranslationInput,
  ): Promise<ProductTranslationRecord> {
    const locale = assertLocale(input.locale);
    const product = await this.products.findOne({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${input.productId} not found`);
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Translation name must not be empty');
    }
    const slug =
      input.slug === undefined || input.slug === null
        ? null
        : input.slug.trim() || null;
    const description =
      input.description === undefined
        ? null
        : input.description === null
          ? null
          : input.description.trim() || null;

    let row = await this.productTranslations.findOne({
      where: { productId: input.productId, locale },
    });
    if (!row) {
      row = this.productTranslations.create({
        productId: input.productId,
        locale,
        name,
        slug,
        description,
      });
    } else {
      row.name = name;
      if (input.slug !== undefined) {
        row.slug = slug;
      }
      if (input.description !== undefined) {
        row.description = description;
      }
    }

    try {
      const saved = await this.productTranslations.save(row);
      return toProductTranslation(saved);
    } catch (error) {
      if (isFkViolation(error)) {
        throw new NotFoundException(`Product ${input.productId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new BadRequestException(
          `Translation for product ${input.productId} locale ${locale} already exists`,
        );
      }
      throw error;
    }
  }

  async upsertCategoryTranslation(
    input: UpsertCategoryTranslationInput,
  ): Promise<CategoryTranslationRecord> {
    const locale = assertLocale(input.locale);
    const category = await this.categories.findOne({
      where: { id: input.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category ${input.categoryId} not found`);
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Translation name must not be empty');
    }
    const slug =
      input.slug === undefined || input.slug === null
        ? null
        : input.slug.trim() || null;
    const description =
      input.description === undefined
        ? null
        : input.description === null
          ? null
          : input.description.trim() || null;

    let row = await this.categoryTranslations.findOne({
      where: { categoryId: input.categoryId, locale },
    });
    if (!row) {
      row = this.categoryTranslations.create({
        categoryId: input.categoryId,
        locale,
        name,
        slug,
        description,
      });
    } else {
      row.name = name;
      if (input.slug !== undefined) {
        row.slug = slug;
      }
      if (input.description !== undefined) {
        row.description = description;
      }
    }

    try {
      const saved = await this.categoryTranslations.save(row);
      return toCategoryTranslation(saved);
    } catch (error) {
      if (isFkViolation(error)) {
        throw new NotFoundException(`Category ${input.categoryId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new BadRequestException(
          `Translation for category ${input.categoryId} locale ${locale} already exists`,
        );
      }
      throw error;
    }
  }

  async deleteProductTranslation(
    productId: string,
    locale: string,
  ): Promise<boolean> {
    const normalized = assertLocale(locale);
    const result = await this.productTranslations.delete({
      productId,
      locale: normalized,
    });
    return (result.affected ?? 0) > 0;
  }

  async deleteCategoryTranslation(
    categoryId: string,
    locale: string,
  ): Promise<boolean> {
    const normalized = assertLocale(locale);
    const result = await this.categoryTranslations.delete({
      categoryId,
      locale: normalized,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Overlay locale fields onto a product. Missing translation → base fields.
   */
  async applyProductLocale(
    product: ProductType,
    locale: string | null | undefined,
  ): Promise<ProductType> {
    if (!locale) {
      return product;
    }
    const normalized = assertLocale(locale);
    const row = await this.productTranslations.findOne({
      where: { productId: product.id, locale: normalized },
    });
    return overlayFields(product, row);
  }

  /**
   * Batch overlay for list queries (one IN query).
   */
  async applyProductLocaleMany(
    products: ProductType[],
    locale: string | null | undefined,
  ): Promise<ProductType[]> {
    if (!locale || products.length === 0) {
      return products;
    }
    const normalized = assertLocale(locale);
    const rows = await this.productTranslations.find({
      where: {
        productId: In(products.map((p) => p.id)),
        locale: normalized,
      },
    });
    const byProduct = new Map(rows.map((r) => [r.productId, r]));
    return products.map((p) => overlayFields(p, byProduct.get(p.id) ?? null));
  }

  async applyCategoryLocale(
    category: CategoryType,
    locale: string | null | undefined,
  ): Promise<CategoryType> {
    if (!locale) {
      return category;
    }
    const normalized = assertLocale(locale);
    const row = await this.categoryTranslations.findOne({
      where: { categoryId: category.id, locale: normalized },
    });
    return overlayFields(category, row);
  }

  async applyCategoryLocaleMany(
    categories: CategoryType[],
    locale: string | null | undefined,
  ): Promise<CategoryType[]> {
    if (!locale || categories.length === 0) {
      return categories;
    }
    const normalized = assertLocale(locale);
    const rows = await this.categoryTranslations.find({
      where: {
        categoryId: In(categories.map((c) => c.id)),
        locale: normalized,
      },
    });
    const byCategory = new Map(rows.map((r) => [r.categoryId, r]));
    return categories.map((c) =>
      overlayFields(c, byCategory.get(c.id) ?? null),
    );
  }
}
