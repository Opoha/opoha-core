import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CouponEntity } from './entities/coupon.entity';
import type {
  CreateCouponInput,
  CouponType,
  UpdateCouponInput,
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

function toCouponType(row: CouponEntity): CouponType {
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
    maxUses: row.maxUses,
    maxUsesPerCustomer: row.maxUsesPerCustomer,
    usageCount: row.usageCount,
    priority: row.priority,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    metadataJson: row.metadata ? JSON.stringify(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(CouponEntity)
    private readonly coupons: Repository<CouponEntity>,
  ) {}

  async findAll(): Promise<CouponType[]> {
    const rows = await this.coupons.find({ order: { code: 'ASC' } });
    return rows.map(toCouponType);
  }

  async findById(id: string): Promise<CouponType> {
    const row = await this.coupons.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Coupon ${id} not found`);
    }
    return toCouponType(row);
  }

  async create(input: CreateCouponInput): Promise<CouponType> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const coupon = this.coupons.create({
      code,
      name,
      description: input.description?.trim() || null,
      kind: input.kind,
      valueBps: input.valueBps ?? null,
      amountMinor: input.amountMinor ?? null,
      currencyCode: input.currencyCode?.trim().toUpperCase() || null,
      minSubtotalMinor: input.minSubtotalMinor ?? null,
      maxUses: input.maxUses ?? null,
      maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
      priority: input.priority ?? 0,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive ?? true,
      metadata: parseJsonObject(input.metadataJson, 'metadataJson') ?? null,
    });
    try {
      const saved = await this.coupons.save(coupon);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Coupon code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateCouponInput): Promise<CouponType> {
    const row = await this.coupons.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Coupon ${id} not found`);
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
    if (input.maxUses !== undefined) {
      row.maxUses = input.maxUses;
    }
    if (input.maxUsesPerCustomer !== undefined) {
      row.maxUsesPerCustomer = input.maxUsesPerCustomer;
    }
    if (input.priority !== undefined) {
      row.priority = input.priority;
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
    if (input.metadataJson !== undefined) {
      row.metadata = parseJsonObject(input.metadataJson, 'metadataJson') ?? null;
    }
    try {
      await this.coupons.save(row);
      return this.findById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Coupon code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<CouponType> {
    const existing = await this.findById(id);
    await this.coupons.delete({ id });
    return existing;
  }
}
