import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { BrandEntity } from '../entities/brand.entity';
import type {
  BrandType,
  CreateBrandInput,
  UpdateBrandInput,
} from './brand.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toBrandType(row: BrandEntity): BrandType {
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
export class BrandsService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brands: Repository<BrandEntity>,
  ) {}

  async findAll(): Promise<BrandType[]> {
    const rows = await this.brands.find({
      order: { createdAt: 'ASC' },
    });
    return rows.map(toBrandType);
  }

  async findById(id: string): Promise<BrandType> {
    const row = await this.brands.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return toBrandType(row);
  }

  async create(input: CreateBrandInput): Promise<BrandType> {
    const brand = this.brands.create({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.brands.save(brand);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Brand slug "${brand.slug}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateBrandInput): Promise<BrandType> {
    const row = await this.brands.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Brand ${id} not found`);
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
      await this.brands.save(row);
      return this.findById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Brand slug "${row.slug}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<BrandType> {
    const existing = await this.findById(id);
    await this.brands.delete({ id });
    return existing;
  }
}
