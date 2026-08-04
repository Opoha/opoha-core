import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { StoreService } from '../stores/public';
import { StoreChannelSettingsEntity, type StoreCatalogMode } from './entities';
import { DEFAULT_STORE_CHANNEL_SETTINGS } from './store-channel-settings.defaults';
import type {
  StoreChannelSettingsType,
  UpdateStoreChannelSettingsInput,
} from './store-channel-settings.types';

const COUNTRY_RE = /^[A-Z]{2}$/;
const CATALOG_MODES = new Set<StoreCatalogMode>(['shared', 'isolated']);

function assertTimezone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('timezone must not be empty');
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
  } catch {
    throw new BadRequestException(`Invalid timezone "${value}" (expected IANA identifier)`);
  }
  return trimmed;
}

function assertCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!COUNTRY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid countryCode "${value}" (expected ISO 3166-1 alpha-2)`);
  }
  return normalized;
}

function assertCatalogMode(value: string): StoreCatalogMode {
  if (!CATALOG_MODES.has(value as StoreCatalogMode)) {
    throw new BadRequestException(`Invalid catalogMode "${value}" (expected shared|isolated)`);
  }
  return value as StoreCatalogMode;
}

function parseSettingsJson(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestException('settingsJson must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException('settingsJson must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function toType(row: StoreChannelSettingsEntity): StoreChannelSettingsType {
  return {
    storeId: row.storeId,
    timezone: row.timezone,
    countryCode: row.countryCode,
    catalogMode: row.catalogMode,
    settingsJson: JSON.stringify(row.settingsJson ?? {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class StoreChannelSettingsService {
  constructor(
    @InjectRepository(StoreChannelSettingsEntity)
    private readonly settings: Repository<StoreChannelSettingsEntity>,
    private readonly stores: StoreService,
    private readonly eventBus: EventBusService,
  ) {}

  /** List channel settings for all stores (admin). */
  async findAll(): Promise<StoreChannelSettingsType[]> {
    const rows = await this.settings.find({
      order: { storeId: 'ASC' },
    });
    return rows.map(toType);
  }

  /**
   * Read channel settings for a store, creating defaults when missing.
   * Validates the store exists.
   */
  async getForStore(storeId: string): Promise<StoreChannelSettingsType> {
    await this.stores.findById(storeId);
    const row = await this.ensureRow(storeId);
    return toType(row);
  }

  async update(
    storeId: string,
    input: UpdateStoreChannelSettingsInput,
  ): Promise<StoreChannelSettingsType> {
    await this.stores.findById(storeId);
    const row = await this.ensureRow(storeId);

    if (input.timezone !== undefined) {
      row.timezone = assertTimezone(input.timezone);
    }
    if (input.countryCode !== undefined) {
      row.countryCode = assertCountryCode(input.countryCode);
    }
    if (input.catalogMode !== undefined) {
      row.catalogMode = assertCatalogMode(input.catalogMode);
    }
    if (input.settingsJson !== undefined) {
      row.settingsJson = parseSettingsJson(input.settingsJson);
    }

    const saved = await this.settings.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.StoreChannelSettingsUpdated,
      aggregateType: 'store_channel_settings',
      aggregateId: saved.storeId,
      data: {
        storeId: saved.storeId,
        timezone: saved.timezone,
        countryCode: saved.countryCode,
        catalogMode: saved.catalogMode,
      },
    });

    return toType(saved);
  }

  /**
   * Ensure a defaults row exists for a store (idempotent).
   * Used by GraphQL reads and StoreCreated listener.
   */
  async ensureForStore(storeId: string): Promise<StoreChannelSettingsType> {
    const row = await this.ensureRow(storeId);
    return toType(row);
  }

  private async ensureRow(storeId: string): Promise<StoreChannelSettingsEntity> {
    const existing = await this.settings.findOne({ where: { storeId } });
    if (existing) {
      return existing;
    }
    const created = this.settings.create({
      storeId,
      timezone: DEFAULT_STORE_CHANNEL_SETTINGS.timezone,
      countryCode: DEFAULT_STORE_CHANNEL_SETTINGS.countryCode,
      catalogMode: DEFAULT_STORE_CHANNEL_SETTINGS.catalogMode,
      settingsJson: { ...DEFAULT_STORE_CHANNEL_SETTINGS.settingsJson },
    });
    try {
      return await this.settings.save(created);
    } catch (error) {
      // Concurrent ensure: re-read
      const raced = await this.settings.findOne({ where: { storeId } });
      if (raced) {
        return raced;
      }
      throw error;
    }
  }
}
