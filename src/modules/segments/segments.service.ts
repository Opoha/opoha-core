import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { CustomerSegmentEntity } from './entities/customer-segment.entity';
import {
  evaluateSegmentRules,
  type SegmentMembershipContext,
  type SegmentRules,
} from './segment-rules';
import type {
  CreateCustomerSegmentInput,
  CustomerSegmentType,
  UpdateCustomerSegmentInput,
} from './segments.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toSegmentType(row: CustomerSegmentEntity): CustomerSegmentType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    rules: row.rules,
    isActive: row.isActive,
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

function normalizeRules(rules: SegmentRules | null | undefined): SegmentRules | null {
  if (rules === undefined || rules === null) {
    return null;
  }
  if (typeof rules !== 'object' || Array.isArray(rules)) {
    throw new BadRequestException('rules must be an object');
  }
  return rules;
}

/**
 * Customer segment CRUD + rule-based membership evaluation (Phase 4 E-01 / E-02).
 */
@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(CustomerSegmentEntity)
    private readonly segments: Repository<CustomerSegmentEntity>,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findAll(): Promise<CustomerSegmentType[]> {
    const rows = await this.segments.find({ order: { code: 'ASC' } });
    return rows.map(toSegmentType);
  }

  async findActive(): Promise<CustomerSegmentType[]> {
    const rows = await this.segments.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    return rows.map(toSegmentType);
  }

  async findById(id: string): Promise<CustomerSegmentType> {
    const row = await this.segments.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Customer segment ${id} not found`);
    }
    return toSegmentType(row);
  }

  async findByCode(code: string): Promise<CustomerSegmentType> {
    const row = await this.segments.findOne({
      where: { code: normalizeCode(code) },
    });
    if (!row) {
      throw new NotFoundException(`Customer segment code ${code} not found`);
    }
    return toSegmentType(row);
  }

  async create(input: CreateCustomerSegmentInput): Promise<CustomerSegmentType> {
    const entity = this.segments.create({
      code: normalizeCode(input.code),
      name: normalizeName(input.name),
      description: input.description?.trim() || null,
      rules: normalizeRules(input.rules),
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.segments.save(entity);
      await this.publishUpdated(saved);
      return toSegmentType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Customer segment code already exists: ${normalizeCode(input.code)}`,
        );
      }
      throw error;
    }
  }

  async update(input: UpdateCustomerSegmentInput): Promise<CustomerSegmentType> {
    const row = await this.segments.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Customer segment ${input.id} not found`);
    }
    if (input.code !== undefined) {
      row.code = normalizeCode(input.code);
    }
    if (input.name !== undefined) {
      row.name = normalizeName(input.name);
    }
    if (input.description !== undefined) {
      row.description = input.description?.trim() || null;
    }
    if (input.rules !== undefined) {
      row.rules = normalizeRules(input.rules);
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    try {
      const saved = await this.segments.save(row);
      await this.publishUpdated(saved);
      return toSegmentType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Customer segment code already exists: ${row.code}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<CustomerSegmentType> {
    const row = await this.segments.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Customer segment ${id} not found`);
    }
    await this.segments.remove(row);
    await this.publishUpdated(row);
    return toSegmentType(row);
  }

  /**
   * Evaluate whether `context` matches a stored segment (must be active).
   */
  async customerMatchesSegment(
    segmentId: string,
    context: SegmentMembershipContext,
  ): Promise<boolean> {
    const row = await this.segments.findOne({ where: { id: segmentId } });
    if (!row) {
      throw new NotFoundException(`Customer segment ${segmentId} not found`);
    }
    if (!row.isActive) {
      return false;
    }
    return evaluateSegmentRules(row.rules, context);
  }

  /**
   * Return all active segments whose rules match `context`.
   */
  async listMatchingSegments(context: SegmentMembershipContext): Promise<CustomerSegmentType[]> {
    const active = await this.findActive();
    return active.filter((segment) => evaluateSegmentRules(segment.rules, context));
  }

  /** Pure helper re-export for callers that already have rules. */
  evaluateRules(
    rules: SegmentRules | null | undefined,
    context: SegmentMembershipContext,
  ): boolean {
    return evaluateSegmentRules(rules, context);
  }

  private async publishUpdated(row: CustomerSegmentEntity): Promise<void> {
    if (!this.eventBus) return;
    await this.eventBus.publish({
      eventName: CoreEventName.SegmentUpdated,
      aggregateType: 'customer_segment',
      aggregateId: row.id,
      data: {
        segmentId: row.id,
        code: row.code,
        name: row.name,
        isActive: row.isActive,
        updatedAt: (row.updatedAt ?? new Date()).toISOString(),
      },
    });
  }
}
