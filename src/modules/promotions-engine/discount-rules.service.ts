import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { DiscountRuleEntity } from './entities/discount-rule.entity';
import type {
  CreateDiscountRuleInput,
  DiscountRuleType,
  UpdateDiscountRuleInput,
} from './promotion.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function parseJsonObject(
  json: string | undefined,
  field: string,
): Record<string, unknown> | undefined {
  if (!json) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${field} must encode a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException(`${field} must be a valid JSON object string`);
  }
}

function toDiscountRuleType(row: DiscountRuleEntity): DiscountRuleType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    kind: row.kind,
    valueBps: row.valueBps,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    minSubtotalMinor: row.minSubtotalMinor,
    priority: row.priority,
    stackable: row.stackable,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    conditionsJson: row.conditions ? JSON.stringify(row.conditions) : null,
    metadataJson: row.metadata ? JSON.stringify(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class DiscountRulesService {
  constructor(
    @InjectRepository(DiscountRuleEntity)
    private readonly rules: Repository<DiscountRuleEntity>,
  ) {}

  async findAll(): Promise<DiscountRuleType[]> {
    const rows = await this.rules.find({
      order: { priority: 'DESC', code: 'ASC' },
    });
    return rows.map(toDiscountRuleType);
  }

  async findById(id: string): Promise<DiscountRuleType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Discount rule ${id} not found`);
    }
    return toDiscountRuleType(row);
  }

  async create(input: CreateDiscountRuleInput): Promise<DiscountRuleType> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const rule = this.rules.create({
      code,
      name,
      description: input.description?.trim() || null,
      kind: input.kind,
      valueBps: input.valueBps ?? null,
      amountMinor: input.amountMinor ?? null,
      currencyCode: input.currencyCode?.trim().toUpperCase() || null,
      minSubtotalMinor: input.minSubtotalMinor ?? null,
      priority: input.priority ?? 0,
      stackable: input.stackable ?? false,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive ?? true,
      conditions: parseJsonObject(input.conditionsJson, 'conditionsJson') ?? null,
      metadata: parseJsonObject(input.metadataJson, 'metadataJson') ?? null,
    });
    try {
      const saved = await this.rules.save(rule);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Discount rule code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateDiscountRuleInput): Promise<DiscountRuleType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Discount rule ${id} not found`);
    }
    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
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
    if (input.kind !== undefined) {
      row.kind = input.kind;
    }
    if (input.valueBps !== undefined) {
      row.valueBps = input.valueBps;
    }
    if (input.amountMinor !== undefined) {
      row.amountMinor = input.amountMinor;
    }
    if (input.currencyCode !== undefined) {
      row.currencyCode = input.currencyCode.trim().toUpperCase() || null;
    }
    if (input.minSubtotalMinor !== undefined) {
      row.minSubtotalMinor = input.minSubtotalMinor;
    }
    if (input.priority !== undefined) {
      row.priority = input.priority;
    }
    if (input.stackable !== undefined) {
      row.stackable = input.stackable;
    }
    if (input.startsAt !== undefined) {
      row.startsAt = input.startsAt;
    }
    if (input.endsAt !== undefined) {
      row.endsAt = input.endsAt;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    if (input.conditionsJson !== undefined) {
      row.conditions = parseJsonObject(input.conditionsJson, 'conditionsJson') ?? null;
    }
    if (input.metadataJson !== undefined) {
      row.metadata = parseJsonObject(input.metadataJson, 'metadataJson') ?? null;
    }
    try {
      await this.rules.save(row);
      return this.findById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Discount rule code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<DiscountRuleType> {
    const existing = await this.findById(id);
    await this.rules.delete({ id });
    return existing;
  }
}
