import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { TaxClassEntity } from './entities/tax-class.entity';
import { TaxRuleEntity } from './entities/tax-rule.entity';
import type { CreateTaxRuleInput, TaxRuleType, UpdateTaxRuleInput } from './tax.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toTaxRuleType(row: TaxRuleEntity): TaxRuleType {
  return {
    id: row.id,
    taxClassId: row.taxClassId,
    name: row.name,
    countryCode: row.countryCode,
    province: row.province,
    postalCode: row.postalCode,
    rateBps: row.rateBps,
    priority: row.priority,
    appliesToShipping: row.appliesToShipping,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requireNonNegativeInt(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer`);
  }
  return value;
}

@Injectable()
export class TaxRulesService {
  constructor(
    @InjectRepository(TaxRuleEntity)
    private readonly rules: Repository<TaxRuleEntity>,
    @InjectRepository(TaxClassEntity)
    private readonly classes: Repository<TaxClassEntity>,
  ) {}

  async findAll(taxClassId?: string): Promise<TaxRuleType[]> {
    const rows = await this.rules.find({
      where: taxClassId ? { taxClassId } : undefined,
      order: { priority: 'DESC', countryCode: 'ASC', name: 'ASC' },
    });
    return rows.map(toTaxRuleType);
  }

  async findById(id: string): Promise<TaxRuleType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Tax rule ${id} not found`);
    }
    return toTaxRuleType(row);
  }

  async create(input: CreateTaxRuleInput): Promise<TaxRuleType> {
    const taxClassId = input.taxClassId.trim();
    const taxClass = await this.classes.findOne({ where: { id: taxClassId } });
    if (!taxClass) {
      throw new NotFoundException(`Tax class ${taxClassId} not found`);
    }

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const countryCode = input.countryCode.trim().toUpperCase();
    if (!countryCode || countryCode.length !== 2) {
      throw new BadRequestException('countryCode must be a 2-letter ISO 3166-1 alpha-2 code');
    }
    const rateBps = requireNonNegativeInt(input.rateBps, 'rateBps');
    const priority = requireNonNegativeInt(input.priority ?? 0, 'priority');

    const rule = this.rules.create({
      taxClassId,
      name,
      countryCode,
      province: input.province?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      rateBps,
      priority,
      appliesToShipping: input.appliesToShipping ?? false,
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.rules.save(rule);
      return this.findById(saved.id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException(`Tax class ${taxClassId} not found`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateTaxRuleInput): Promise<TaxRuleType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Tax rule ${id} not found`);
    }

    if (input.taxClassId !== undefined) {
      const taxClassId = input.taxClassId.trim();
      const taxClass = await this.classes.findOne({ where: { id: taxClassId } });
      if (!taxClass) {
        throw new NotFoundException(`Tax class ${taxClassId} not found`);
      }
      row.taxClassId = taxClassId;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      row.name = name;
    }
    if (input.countryCode !== undefined) {
      const countryCode = input.countryCode.trim().toUpperCase();
      if (!countryCode || countryCode.length !== 2) {
        throw new BadRequestException('countryCode must be a 2-letter ISO 3166-1 alpha-2 code');
      }
      row.countryCode = countryCode;
    }
    if (input.province !== undefined) {
      row.province = input.province.trim() || null;
    }
    if (input.postalCode !== undefined) {
      row.postalCode = input.postalCode.trim() || null;
    }
    if (input.rateBps !== undefined) {
      row.rateBps = requireNonNegativeInt(input.rateBps, 'rateBps');
    }
    if (input.priority !== undefined) {
      row.priority = requireNonNegativeInt(input.priority, 'priority');
    }
    if (input.appliesToShipping !== undefined) {
      row.appliesToShipping = input.appliesToShipping;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }

    try {
      await this.rules.save(row);
      return this.findById(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException(`Tax class ${row.taxClassId} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<TaxRuleType> {
    const existing = await this.findById(id);
    await this.rules.delete({ id });
    return existing;
  }
}
