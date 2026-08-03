import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CollectionEntity } from '../entities/collection.entity';
import type {
  CollectionType,
  CreateCollectionInput,
  UpdateCollectionInput,
} from './collection.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toCollectionType(row: CollectionEntity): CollectionType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(CollectionEntity)
    private readonly collections: Repository<CollectionEntity>,
  ) {}

  async findAll(): Promise<CollectionType[]> {
    const rows = await this.collections.find({
      order: { createdAt: 'ASC' },
    });
    return rows.map(toCollectionType);
  }

  async findById(id: string): Promise<CollectionType> {
    const row = await this.collections.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Collection ${id} not found`);
    }
    return toCollectionType(row);
  }

  async create(input: CreateCollectionInput): Promise<CollectionType> {
    const collection = this.collections.create({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.collections.save(collection);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Collection slug "${collection.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionType> {
    const row = await this.collections.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Collection ${id} not found`);
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
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    try {
      await this.collections.save(row);
      return this.findById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Collection slug "${row.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<CollectionType> {
    const existing = await this.findById(id);
    await this.collections.delete({ id });
    return existing;
  }
}
