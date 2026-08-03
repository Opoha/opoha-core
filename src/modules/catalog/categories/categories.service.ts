import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';

import { CategoryEntity } from '../entities/category.entity';
import type {
  CategoryType,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.types';

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

function normalizeStoreId(
  value: string | null | undefined,
): string | null | undefined {
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
  ) {}

  /**
   * List categories. When `storeId` is provided, returns shared (`storeId` null)
   * plus store-owned rows for that store. Omit for admin/global listing.
   */
  async findAll(storeId?: string | null): Promise<CategoryType[]> {
    const scope = normalizeStoreId(storeId);
    const rows = await this.categories.find({
      where:
        scope === undefined || scope === null
          ? undefined
          : [{ storeId: IsNull() }, { storeId: scope }],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toCategoryType);
  }

  async findById(id: string): Promise<CategoryType> {
    const row = await this.categories.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return toCategoryType(row);
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
        throw new ConflictException(
          `Category slug "${category.slug}" already exists`,
        );
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
  private async assertNoCycle(
    categoryId: string,
    proposedParentId: string,
  ): Promise<void> {
    let currentId: string | null = proposedParentId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException(
          'Cannot set parent: would create a category cycle',
        );
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
