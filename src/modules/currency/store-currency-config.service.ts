import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { StoreService } from '../stores/public';
import { StoreCurrencyConfigEntity } from './entities';
import { defaultStoreCurrencyConfig } from './store-currency-config.defaults';
import type {
  StoreCurrencyConfigType,
  UpdateStoreCurrencyConfigInput,
} from './store-currency-config.types';

const CURRENCY_RE = /^[A-Z]{3}$/;

function assertCurrencyCode(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid ${field} "${value}" (expected ISO 4217)`);
  }
  return normalized;
}

function assertCurrencyList(values: string[], field: string): string[] {
  const normalized = values.map((v) => assertCurrencyCode(v, field));
  return [...new Set(normalized)].sort();
}

/**
 * Ensure primary display is always present in the enabled list.
 */
function withPrimaryDisplay(primary: string, enabled: string[]): string[] {
  return [...new Set([primary, ...enabled])].sort();
}

function toType(row: StoreCurrencyConfigEntity): StoreCurrencyConfigType {
  return {
    storeId: row.storeId,
    settlementCurrencyCode: row.settlementCurrencyCode,
    displayCurrencyCode: row.displayCurrencyCode,
    enabledDisplayCurrencies: [...(row.enabledDisplayCurrencies ?? [])].sort(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class StoreCurrencyConfigService {
  constructor(
    @InjectRepository(StoreCurrencyConfigEntity)
    private readonly configs: Repository<StoreCurrencyConfigEntity>,
    private readonly stores: StoreService,
    private readonly eventBus: EventBusService,
  ) {}

  /** List currency configs for all stores (admin). */
  async findAll(): Promise<StoreCurrencyConfigType[]> {
    const rows = await this.configs.find({
      order: { storeId: 'ASC' },
    });
    return rows.map(toType);
  }

  /**
   * Read currency config for a store, creating defaults when missing.
   * Defaults inherit the store's `defaultCurrencyCode` for both display and settlement.
   */
  async getForStore(storeId: string): Promise<StoreCurrencyConfigType> {
    const store = await this.stores.findById(storeId);
    const row = await this.ensureRow(storeId, store.defaultCurrencyCode);
    return toType(row);
  }

  async update(
    storeId: string,
    input: UpdateStoreCurrencyConfigInput,
  ): Promise<StoreCurrencyConfigType> {
    const store = await this.stores.findById(storeId);
    const row = await this.ensureRow(storeId, store.defaultCurrencyCode);

    if (input.settlementCurrencyCode !== undefined) {
      row.settlementCurrencyCode = assertCurrencyCode(
        input.settlementCurrencyCode,
        'settlementCurrencyCode',
      );
    }
    if (input.displayCurrencyCode !== undefined) {
      row.displayCurrencyCode = assertCurrencyCode(
        input.displayCurrencyCode,
        'displayCurrencyCode',
      );
    }
    if (input.enabledDisplayCurrencies !== undefined) {
      row.enabledDisplayCurrencies = assertCurrencyList(
        input.enabledDisplayCurrencies,
        'enabledDisplayCurrencies',
      );
    }

    row.enabledDisplayCurrencies = withPrimaryDisplay(
      row.displayCurrencyCode,
      row.enabledDisplayCurrencies ?? [],
    );

    const saved = await this.configs.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.StoreCurrencyConfigUpdated,
      aggregateType: 'store_currency_config',
      aggregateId: saved.storeId,
      data: {
        storeId: saved.storeId,
        settlementCurrencyCode: saved.settlementCurrencyCode,
        displayCurrencyCode: saved.displayCurrencyCode,
        enabledDisplayCurrencies: [...saved.enabledDisplayCurrencies],
      },
    });

    return toType(saved);
  }

  /**
   * Ensure a defaults row exists for a store (idempotent).
   * Used by GraphQL reads and StoreCreated listener.
   */
  async ensureForStore(storeId: string, currencyHint?: string): Promise<StoreCurrencyConfigType> {
    let hint = currencyHint;
    if (!hint) {
      const store = await this.stores.findById(storeId);
      hint = store.defaultCurrencyCode;
    }
    const row = await this.ensureRow(storeId, hint);
    return toType(row);
  }

  /**
   * Whether `currencyCode` is allowed for customer display on this store.
   */
  async isDisplayCurrencyAllowed(storeId: string, currencyCode: string): Promise<boolean> {
    const config = await this.getForStore(storeId);
    const code = assertCurrencyCode(currencyCode, 'currencyCode');
    return code === config.displayCurrencyCode || config.enabledDisplayCurrencies.includes(code);
  }

  private async ensureRow(
    storeId: string,
    currencyHint: string,
  ): Promise<StoreCurrencyConfigEntity> {
    const existing = await this.configs.findOne({ where: { storeId } });
    if (existing) {
      return existing;
    }
    const defaults = defaultStoreCurrencyConfig(currencyHint);
    const created = this.configs.create({
      storeId,
      settlementCurrencyCode: defaults.settlementCurrencyCode,
      displayCurrencyCode: defaults.displayCurrencyCode,
      enabledDisplayCurrencies: [...defaults.enabledDisplayCurrencies],
    });
    try {
      return await this.configs.save(created);
    } catch (error) {
      const raced = await this.configs.findOne({ where: { storeId } });
      if (raced) {
        return raced;
      }
      throw error;
    }
  }
}
