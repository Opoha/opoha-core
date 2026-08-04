import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { WarehouseEntity } from './entities/warehouse.entity';
import type { CreateWarehouseInput, UpdateWarehouseInput, WarehouseType } from './warehouse.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toWarehouseType(row: WarehouseEntity): WarehouseType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    isDefault: row.isDefault,
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

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
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
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(): Promise<WarehouseType[]> {
    const rows = await this.warehouses.find({
      order: { code: 'ASC' },
    });
    return rows.map(toWarehouseType);
  }

  async findById(id: string): Promise<WarehouseType> {
    const row = await this.warehouses.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
    return toWarehouseType(row);
  }

  async findByCode(code: string): Promise<WarehouseType> {
    const row = await this.warehouses.findOne({
      where: { code: code.trim() },
    });
    if (!row) {
      throw new NotFoundException(`Warehouse code "${code}" not found`);
    }
    return toWarehouseType(row);
  }

  async findDefault(): Promise<WarehouseType | null> {
    const row = await this.warehouses.findOne({ where: { isDefault: true } });
    return row ? toWarehouseType(row) : null;
  }

  async create(input: CreateWarehouseInput): Promise<WarehouseType> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    const makeDefault = input.isDefault === true;

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(WarehouseEntity);
        if (makeDefault) {
          await repo.update({ isDefault: true }, { isDefault: false });
        }
        const warehouse = repo.create({
          code,
          name,
          description: normalizeOptionalText(input.description) ?? null,
          isActive: input.isActive ?? true,
          isDefault: makeDefault,
          addressLine1: normalizeOptionalText(input.addressLine1) ?? null,
          addressLine2: normalizeOptionalText(input.addressLine2) ?? null,
          city: normalizeOptionalText(input.city) ?? null,
          province: normalizeOptionalText(input.province) ?? null,
          postalCode: normalizeOptionalText(input.postalCode) ?? null,
          countryCode: normalizeOptionalText(input.countryCode)?.toUpperCase() ?? null,
        });
        return repo.save(warehouse);
      });

      await this.eventBus.publish({
        eventName: CoreEventName.WarehouseUpdated,
        aggregateType: 'warehouse',
        aggregateId: saved.id,
        data: {
          warehouseId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          isDefault: saved.isDefault,
          action: 'created',
        },
      });

      return toWarehouseType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Warehouse code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateWarehouseInput): Promise<WarehouseType> {
    const existing = await this.warehouses.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Warehouse ${id} not found`);
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

    const makeDefault = input.isDefault === true;
    const clearDefault = input.isDefault === false;

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(WarehouseEntity);
        if (makeDefault) {
          await repo.update({ isDefault: true }, { isDefault: false });
          existing.isDefault = true;
        } else if (clearDefault) {
          existing.isDefault = false;
        }
        return repo.save(existing);
      });

      await this.eventBus.publish({
        eventName: CoreEventName.WarehouseUpdated,
        aggregateType: 'warehouse',
        aggregateId: saved.id,
        data: {
          warehouseId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          isDefault: saved.isDefault,
          action: 'updated',
        },
      });

      return toWarehouseType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Warehouse code "${existing.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<WarehouseType> {
    const existing = await this.warehouses.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }
    if (existing.isDefault) {
      throw new BadRequestException('Cannot delete the default warehouse');
    }

    await this.warehouses.delete({ id });

    await this.eventBus.publish({
      eventName: CoreEventName.WarehouseUpdated,
      aggregateType: 'warehouse',
      aggregateId: existing.id,
      data: {
        warehouseId: existing.id,
        code: existing.code,
        name: existing.name,
        isActive: existing.isActive,
        isDefault: existing.isDefault,
        action: 'deleted',
      },
    });

    return toWarehouseType(existing);
  }
}
