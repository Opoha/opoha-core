import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { SupplierEntity } from './entities/supplier.entity';
import type {
  CreateSupplierInput,
  SupplierType,
  UpdateSupplierInput,
} from './supplier.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toSupplierType(row: SupplierEntity): SupplierType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    email: row.email,
    phone: row.phone,
    contactName: row.contactName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeOptionalText(
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
export class SupplierService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly suppliers: Repository<SupplierEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(): Promise<SupplierType[]> {
    const rows = await this.suppliers.find({
      order: { code: 'ASC' },
    });
    return rows.map(toSupplierType);
  }

  async findById(id: string): Promise<SupplierType> {
    const row = await this.suppliers.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }
    return toSupplierType(row);
  }

  async findByCode(code: string): Promise<SupplierType> {
    const row = await this.suppliers.findOne({
      where: { code: code.trim() },
    });
    if (!row) {
      throw new NotFoundException(`Supplier code "${code}" not found`);
    }
    return toSupplierType(row);
  }

  async create(input: CreateSupplierInput): Promise<SupplierType> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    try {
      const saved = await this.suppliers.save(
        this.suppliers.create({
          code,
          name,
          description: normalizeOptionalText(input.description) ?? null,
          isActive: input.isActive ?? true,
          email: normalizeOptionalText(input.email) ?? null,
          phone: normalizeOptionalText(input.phone) ?? null,
          contactName: normalizeOptionalText(input.contactName) ?? null,
          addressLine1: normalizeOptionalText(input.addressLine1) ?? null,
          addressLine2: normalizeOptionalText(input.addressLine2) ?? null,
          city: normalizeOptionalText(input.city) ?? null,
          province: normalizeOptionalText(input.province) ?? null,
          postalCode: normalizeOptionalText(input.postalCode) ?? null,
          countryCode:
            normalizeOptionalText(input.countryCode)?.toUpperCase() ?? null,
        }),
      );

      await this.eventBus.publish({
        eventName: CoreEventName.SupplierUpdated,
        aggregateType: 'supplier',
        aggregateId: saved.id,
        data: {
          supplierId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          action: 'created',
        },
      });

      return toSupplierType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Supplier code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateSupplierInput): Promise<SupplierType> {
    const existing = await this.suppliers.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) {
        throw new BadRequestException('code cannot be empty');
      }
      existing.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      existing.name = name;
    }
    if (input.description !== undefined) {
      existing.description = normalizeOptionalText(input.description) ?? null;
    }
    if (input.isActive !== undefined) {
      existing.isActive = input.isActive;
    }
    if (input.email !== undefined) {
      existing.email = normalizeOptionalText(input.email) ?? null;
    }
    if (input.phone !== undefined) {
      existing.phone = normalizeOptionalText(input.phone) ?? null;
    }
    if (input.contactName !== undefined) {
      existing.contactName = normalizeOptionalText(input.contactName) ?? null;
    }
    if (input.addressLine1 !== undefined) {
      existing.addressLine1 = normalizeOptionalText(input.addressLine1) ?? null;
    }
    if (input.addressLine2 !== undefined) {
      existing.addressLine2 = normalizeOptionalText(input.addressLine2) ?? null;
    }
    if (input.city !== undefined) {
      existing.city = normalizeOptionalText(input.city) ?? null;
    }
    if (input.province !== undefined) {
      existing.province = normalizeOptionalText(input.province) ?? null;
    }
    if (input.postalCode !== undefined) {
      existing.postalCode = normalizeOptionalText(input.postalCode) ?? null;
    }
    if (input.countryCode !== undefined) {
      const cc = normalizeOptionalText(input.countryCode);
      existing.countryCode = cc ? cc.toUpperCase() : null;
    }

    try {
      const saved = await this.suppliers.save(existing);

      await this.eventBus.publish({
        eventName: CoreEventName.SupplierUpdated,
        aggregateType: 'supplier',
        aggregateId: saved.id,
        data: {
          supplierId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          action: 'updated',
        },
      });

      return toSupplierType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Supplier code "${existing.code}" already exists`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<SupplierType> {
    const existing = await this.suppliers.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Supplier ${id} not found`);
    }

    try {
      await this.suppliers.delete({ id });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Cannot delete supplier ${id}: purchase orders still reference it`,
        );
      }
      throw error;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.SupplierUpdated,
      aggregateType: 'supplier',
      aggregateId: existing.id,
      data: {
        supplierId: existing.id,
        code: existing.code,
        name: existing.name,
        isActive: existing.isActive,
        action: 'deleted',
      },
    });

    return toSupplierType(existing);
  }
}
