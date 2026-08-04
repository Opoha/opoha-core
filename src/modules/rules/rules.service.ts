import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { RuleDefinitionEntity } from './entities/rule-definition.entity';
import { normalizeActionRefs, type RuleActionRef, type RuleConditions } from './rule-conditions';
import type {
  CreateRuleDefinitionInput,
  RuleDefinitionType,
  UpdateRuleDefinitionInput,
} from './rules.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toRuleType(row: RuleDefinitionEntity): RuleDefinitionType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    eventName: row.eventName,
    conditions: row.conditions,
    actionRefs: normalizeActionRefs(row.actionRefs),
    enabled: row.enabled,
    priority: row.priority,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeCode(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) {
    throw new BadRequestException('code is required');
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(trimmed)) {
    throw new BadRequestException(
      'code must be 1–64 chars: lowercase alphanumeric, hyphen, underscore',
    );
  }
  return trimmed;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new BadRequestException('name is required');
  }
  return trimmed;
}

function normalizeEventName(eventName: string): string {
  const trimmed = eventName.trim();
  if (!trimmed) {
    throw new BadRequestException('eventName is required');
  }
  return trimmed;
}

function normalizeConditions(conditions: RuleConditions | null | undefined): RuleConditions | null {
  if (conditions === undefined || conditions === null) {
    return null;
  }
  if (typeof conditions !== 'object' || Array.isArray(conditions)) {
    throw new BadRequestException('conditions must be an object');
  }
  return conditions;
}

function normalizePriority(priority: number | undefined): number {
  if (priority === undefined) {
    return 100;
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
    throw new BadRequestException('priority must be an integer 0–10000');
  }
  return priority;
}

/**
 * Rule definition CRUD.
 */
@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(RuleDefinitionEntity)
    private readonly rules: Repository<RuleDefinitionEntity>,
  ) {}

  async findAll(): Promise<RuleDefinitionType[]> {
    const rows = await this.rules.find({
      order: { priority: 'ASC', code: 'ASC' },
    });
    return rows.map(toRuleType);
  }

  async findById(id: string): Promise<RuleDefinitionType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Rule "${id}" not found`);
    }
    return toRuleType(row);
  }

  async findByCode(code: string): Promise<RuleDefinitionType> {
    const row = await this.rules.findOne({
      where: { code: normalizeCode(code) },
    });
    if (!row) {
      throw new NotFoundException(`Rule code "${code}" not found`);
    }
    return toRuleType(row);
  }

  async findEnabledByEventName(eventName: string): Promise<RuleDefinitionType[]> {
    const rows = await this.rules.find({
      where: { eventName: normalizeEventName(eventName), enabled: true },
      order: { priority: 'ASC', code: 'ASC' },
    });
    return rows.map(toRuleType);
  }

  async create(input: CreateRuleDefinitionInput): Promise<RuleDefinitionType> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const eventName = normalizeEventName(input.eventName);
    const conditions = normalizeConditions(input.conditions);
    const actionRefs = normalizeActionRefs(input.actionRefs);
    const enabled = input.enabled ?? true;
    const priority = normalizePriority(input.priority);
    const description =
      input.description === undefined || input.description === null
        ? null
        : input.description.trim() || null;

    const existing = await this.rules.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Rule code "${code}" already exists`);
    }

    const row = this.rules.create({
      code,
      name,
      description,
      eventName,
      conditions,
      actionRefs,
      enabled,
      priority,
    });

    try {
      const saved = await this.rules.save(row);
      return toRuleType(saved);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Rule code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(input: UpdateRuleDefinitionInput): Promise<RuleDefinitionType> {
    const row = await this.rules.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Rule "${input.id}" not found`);
    }

    if (input.code !== undefined) {
      row.code = normalizeCode(input.code);
    }
    if (input.name !== undefined) {
      row.name = normalizeName(input.name);
    }
    if (input.description !== undefined) {
      row.description = input.description === null ? null : input.description.trim() || null;
    }
    if (input.eventName !== undefined) {
      row.eventName = normalizeEventName(input.eventName);
    }
    if (input.conditions !== undefined) {
      row.conditions = normalizeConditions(input.conditions);
    }
    if (input.actionRefs !== undefined) {
      row.actionRefs = normalizeActionRefs(input.actionRefs);
    }
    if (input.enabled !== undefined) {
      row.enabled = input.enabled;
    }
    if (input.priority !== undefined) {
      row.priority = normalizePriority(input.priority);
    }

    try {
      const saved = await this.rules.save(row);
      return toRuleType(saved);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Rule code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<RuleDefinitionType> {
    const row = await this.rules.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Rule "${id}" not found`);
    }
    const snapshot = toRuleType(row);
    await this.rules.remove(row);
    return snapshot;
  }

  /** Test / gate helper — persist a raw row shape without full validation. */
  async saveRaw(
    partial: Partial<RuleDefinitionEntity> & {
      code: string;
      name: string;
      eventName: string;
    },
  ): Promise<RuleDefinitionType> {
    const actionRefs: RuleActionRef[] = normalizeActionRefs(partial.actionRefs);
    const row = this.rules.create({
      enabled: true,
      priority: 100,
      description: null,
      conditions: null,
...partial,
      actionRefs,
    });
    const saved = await this.rules.save(row);
    return toRuleType(saved);
  }
}
