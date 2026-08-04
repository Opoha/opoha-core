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
import { StoreEntity } from './entities/store.entity';
import type { CreateStoreInput, StoreType, UpdateStoreInput } from './store.types';

const CURRENCY_RE = /^[A-Z]{3}$/;
const LOCALE_RE = /^[a-z]{2}(-[A-Za-z0-9]+)*$/;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toStoreType(row: StoreEntity): StoreType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    isDefault: row.isDefault,
    defaultCurrencyCode: row.defaultCurrencyCode,
    defaultLocale: row.defaultLocale,
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

function assertCurrencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid defaultCurrencyCode "${value}" (expected ISO 4217)`);
  }
  return normalized;
}

function assertLocale(value: string): string {
  const trimmed = value.trim();
  if (!LOCALE_RE.test(trimmed)) {
    throw new BadRequestException(
      `Invalid defaultLocale "${value}" (expected BCP 47-like tag, e.g. en-US)`,
    );
  }
  return trimmed;
}

function eventData(row: StoreEntity) {
  return {
    storeId: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    isDefault: row.isDefault,
    defaultCurrencyCode: row.defaultCurrencyCode,
    defaultLocale: row.defaultLocale,
  };
}

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly stores: Repository<StoreEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(): Promise<StoreType[]> {
    const rows = await this.stores.find({
      order: { code: 'ASC' },
    });
    return rows.map(toStoreType);
  }

  async findById(id: string): Promise<StoreType> {
    const row = await this.stores.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Store ${id} not found`);
    }
    return toStoreType(row);
  }

  async findByCode(code: string): Promise<StoreType> {
    const row = await this.stores.findOne({
      where: { code: code.trim() },
    });
    if (!row) {
      throw new NotFoundException(`Store code "${code}" not found`);
    }
    return toStoreType(row);
  }

  async findDefault(): Promise<StoreType | null> {
    const row = await this.stores.findOne({ where: { isDefault: true } });
    return row ? toStoreType(row) : null;
  }

  async create(input: CreateStoreInput): Promise<StoreType> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const defaultCurrencyCode = assertCurrencyCode(input.defaultCurrencyCode);
    const defaultLocale = assertLocale(input.defaultLocale);
    const makeDefault = input.isDefault === true;

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(StoreEntity);
        if (makeDefault) {
          await repo.update({ isDefault: true }, { isDefault: false });
        }
        const store = repo.create({
          code,
          name,
          description: normalizeOptionalText(input.description) ?? null,
          isActive: input.isActive ?? true,
          isDefault: makeDefault,
          defaultCurrencyCode,
          defaultLocale,
        });
        return repo.save(store);
      });

      await this.eventBus.publish({
        eventName: CoreEventName.StoreCreated,
        aggregateType: 'store',
        aggregateId: saved.id,
        data: eventData(saved),
      });

      return toStoreType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Store code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateStoreInput): Promise<StoreType> {
    const existing = await this.stores.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Store ${id} not found`);
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
    if (input.defaultCurrencyCode !== undefined) {
      existing.defaultCurrencyCode = assertCurrencyCode(input.defaultCurrencyCode);
    }
    if (input.defaultLocale !== undefined) {
      existing.defaultLocale = assertLocale(input.defaultLocale);
    }

    const makeDefault = input.isDefault === true;
    const clearDefault = input.isDefault === false;

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(StoreEntity);
        if (makeDefault) {
          await repo.update({ isDefault: true }, { isDefault: false });
          existing.isDefault = true;
        } else if (clearDefault) {
          existing.isDefault = false;
        }
        return repo.save(existing);
      });

      await this.eventBus.publish({
        eventName: CoreEventName.StoreUpdated,
        aggregateType: 'store',
        aggregateId: saved.id,
        data: eventData(saved),
      });

      return toStoreType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Store code "${existing.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<StoreType> {
    const existing = await this.stores.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Store ${id} not found`);
    }
    if (existing.isDefault) {
      throw new BadRequestException('Cannot delete the default store');
    }

    await this.stores.delete({ id });

    await this.eventBus.publish({
      eventName: CoreEventName.StoreUpdated,
      aggregateType: 'store',
      aggregateId: existing.id,
      data: eventData(existing),
    });

    return toStoreType(existing);
  }
}
