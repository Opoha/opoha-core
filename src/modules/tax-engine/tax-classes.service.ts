import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { TaxClassEntity } from './entities/tax-class.entity';
import type { CreateTaxClassInput, TaxClassType, UpdateTaxClassInput } from './tax.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toTaxClassType(row: TaxClassEntity): TaxClassType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class TaxClassesService {
  constructor(
    @InjectRepository(TaxClassEntity)
    private readonly classes: Repository<TaxClassEntity>,
  ) {}

  async findAll(): Promise<TaxClassType[]> {
    const rows = await this.classes.find({
      order: { code: 'ASC' },
    });
    return rows.map(toTaxClassType);
  }

  async findById(id: string): Promise<TaxClassType> {
    const row = await this.classes.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Tax class ${id} not found`);
    }
    return toTaxClassType(row);
  }

  async create(input: CreateTaxClassInput): Promise<TaxClassType> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const taxClass = this.classes.create({
      code,
      name,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.classes.save(taxClass);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Tax class code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateTaxClassInput): Promise<TaxClassType> {
    const row = await this.classes.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Tax class ${id} not found`);
    }
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) {
        throw new BadRequestException('code cannot be empty');
      }
      row.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      row.name = name;
    }
    if (input.description !== undefined) {
      row.description = input.description.trim() || null;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    try {
      await this.classes.save(row);
      return this.findById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Tax class code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<TaxClassType> {
    const existing = await this.findById(id);
    await this.classes.delete({ id });
    return existing;
  }
}
