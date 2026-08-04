import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import type { StoreCatalogMode } from '../../config/public';
import { StoreChannelSettingsService } from '../../config/public';
import { CategoryEntity } from '../entities/category.entity';
import { catalogStoreWhere } from '../store-catalog-scope';
import { CatalogTranslationsService } from '../translations/catalog-translations.service';
import type { CategoryType, CreateCategoryInput, UpdateCategoryInput } from './category.types';

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

function toCategoryType(row: CategoryEntity): CategoryType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    storeId: row.storeId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeStoreId(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @Optional()
    private readonly channelSettings?: StoreChannelSettingsService,
    @Optional()
    private readonly translations?: CatalogTranslationsService,
  ) {}

  /**
 * List categories.
   * When `storeId` is set:
   * - `shared` → shared (`storeId` null) ∪ store-owned
   * - `isolated` → store-owned only
   * Omit `catalogMode` to resolve from store channel settings (default shared).
   * Omit `storeId` for admin/global listing.
   * Optional `locale` overlays translated name/slug/description.
   */
  async findAll(
    storeId?: string | null,
    catalogMode?: StoreCatalogMode | null,
    locale?: string | null,
  ): Promise<CategoryType[]> {
    const scope = normalizeStoreId(storeId);
    const mode = await this.resolveCatalogMode(scope, catalogMode);
    const rows = await this.categories.find({
      where: catalogStoreWhere<CategoryEntity>(scope, mode),
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const categories = rows.map(toCategoryType);
    if (this.translations) {
      return this.translations.applyCategoryLocaleMany(categories, locale);
    }
    return categories;
  }

  private async resolveCatalogMode(
    storeId: string | null | undefined,
    catalogMode?: StoreCatalogMode | null,
  ): Promise<StoreCatalogMode> {
    if (catalogMode === 'shared' || catalogMode === 'isolated') {
      return catalogMode;
    }
    if (storeId && this.channelSettings) {
      const settings = await this.channelSettings.getForStore(storeId);
      return settings.catalogMode;
    }
    return 'shared';
  }

  async findById(id: string, locale?: string | null): Promise<CategoryType> {
    const row = await this.categories.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    const category = toCategoryType(row);
    if (this.translations) {
      return this.translations.applyCategoryLocale(category, locale);
    }
    return category;
  }

  async create(input: CreateCategoryInput): Promise<CategoryType> {
    if (input.parentId) {
      await this.assertParentExists(input.parentId);
    }
    const storeId = normalizeStoreId(input.storeId) ?? null;
    const category = this.categories.create({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      storeId,
    });
    try {
      const saved = await this.categories.save(category);
      return this.findById(saved.id);
    } catch (error) {
      if (isFkViolation(error)) {
        throw new BadRequestException(`Store ${storeId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Category slug "${category.slug}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryType> {
    const row = await this.categories.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    if (input.name !== undefined) {
      row.name = input.name.trim();
    }
    if (input.slug !== undefined) {
      row.slug = input.slug.trim();
    }
    if (input.description !== undefined) {
      row.description = input.description.trim() || null;
    }
    if (input.parentId !== undefined) {
      if (input.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      if (input.parentId) {
        await this.assertParentExists(input.parentId);
        await this.assertNoCycle(id, input.parentId);
      }
      row.parentId = input.parentId;
    }
    if (input.sortOrder !== undefined) {
      row.sortOrder = input.sortOrder;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    if (input.storeId !== undefined) {
      row.storeId = normalizeStoreId(input.storeId) ?? null;
    }
    try {
      await this.categories.save(row);
      return this.findById(id);
    } catch (error) {
      if (isFkViolation(error)) {
        throw new BadRequestException(`Store ${row.storeId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Category slug "${row.slug}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<CategoryType> {
    const existing = await this.findById(id);
    await this.categories.delete({ id });
    return existing;
  }

  private async assertParentExists(parentId: string): Promise<void> {
    const parent = await this.categories.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new NotFoundException(`Parent category ${parentId} not found`);
    }
  }

  /** Walk ancestors of proposed parent; fail if `categoryId` appears. */
  private async assertNoCycle(categoryId: string, proposedParentId: string): Promise<void> {
    let currentId: string | null = proposedParentId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException('Cannot set parent: would create a category cycle');
      }
      if (seen.has(currentId)) {
        break;
      }
      seen.add(currentId);
      const current: CategoryEntity | null = await this.categories.findOne({
        where: { id: currentId },
      });
      currentId = current?.parentId ?? null;
    }
  }
}
