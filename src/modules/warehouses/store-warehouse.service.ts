import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { StoreService } from '../stores/public';
import { StoreWarehouseEntity } from './entities/store-warehouse.entity';
import { WarehouseEntity } from './entities/warehouse.entity';
import type { StoreWarehouseType } from './store-warehouse.types';
import type { WarehouseType } from './warehouse.types';
import { WarehouseService } from './warehouse.service';

function toType(row: StoreWarehouseEntity): StoreWarehouseType {
  return {
    storeId: row.storeId,
    warehouseId: row.warehouseId,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class StoreWarehouseService {
  constructor(
    @InjectRepository(StoreWarehouseEntity)
    private readonly links: Repository<StoreWarehouseEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly stores: StoreService,
    private readonly warehouseService: WarehouseService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async listForStore(storeId: string): Promise<StoreWarehouseType[]> {
    await this.stores.findById(storeId);
    const rows = await this.links.find({
      where: { storeId },
      order: { isPrimary: 'DESC', warehouseId: 'ASC' },
    });
    return rows.map(toType);
  }

  async listWarehousesForStore(storeId: string): Promise<WarehouseType[]> {
    await this.stores.findById(storeId);
    const rows = await this.links.find({
      where: { storeId },
      order: { isPrimary: 'DESC', warehouseId: 'ASC' },
    });
    const out: WarehouseType[] = [];
    for (const row of rows) {
      out.push(await this.warehouseService.findById(row.warehouseId));
    }
    return out;
  }

  async listWarehouseIdsForStore(storeId: string): Promise<string[]> {
    const rows = await this.links.find({
      where: { storeId },
      select: ['warehouseId'],
      order: { isPrimary: 'DESC', warehouseId: 'ASC' },
    });
    return rows.map((r) => r.warehouseId);
  }

  /**
   * Prefer primary association, else first linked warehouse id.
   * Returns null when the store has no warehouse links.
   */
  async resolvePrimaryWarehouseId(storeId: string): Promise<string | null> {
    const primary = await this.links.findOne({
      where: { storeId, isPrimary: true },
    });
    if (primary) {
      return primary.warehouseId;
    }
    const first = await this.links.findOne({
      where: { storeId },
      order: { warehouseId: 'ASC' },
    });
    return first?.warehouseId ?? null;
  }

  /**
 * Throws when warehouse is not associated with the store (/ guards).
   */
  async assertWarehouseAllowedForStore(storeId: string, warehouseId: string): Promise<void> {
    const link = await this.links.findOne({
      where: { storeId, warehouseId },
    });
    if (!link) {
      throw new BadRequestException(
        `Warehouse ${warehouseId} is not associated with store ${storeId}`,
      );
    }
  }

  async isWarehouseAllowedForStore(storeId: string, warehouseId: string): Promise<boolean> {
    const link = await this.links.findOne({
      where: { storeId, warehouseId },
    });
    return link != null;
  }

  /**
 * Transfer guard: optional store scope, else require shared store when both warehouses are linked.
   */
  async assertTransferAllowed(
    fromWarehouseId: string,
    toWarehouseId: string,
    storeId?: string | null,
  ): Promise<void> {
    if (storeId) {
      await this.assertWarehouseAllowedForStore(storeId, fromWarehouseId);
      await this.assertWarehouseAllowedForStore(storeId, toWarehouseId);
      return;
    }

    const fromLinks = await this.links.find({
      where: { warehouseId: fromWarehouseId },
      select: ['storeId'],
    });
    const toLinks = await this.links.find({
      where: { warehouseId: toWarehouseId },
      select: ['storeId'],
    });
    if (fromLinks.length === 0 || toLinks.length === 0) {
      return;
    }
    const toStores = new Set(toLinks.map((r) => r.storeId));
    if (!fromLinks.some((r) => toStores.has(r.storeId))) {
      throw new BadRequestException(
        `Warehouses ${fromWarehouseId} and ${toWarehouseId} do not share a store association`,
      );
    }
  }

  async link(storeId: string, warehouseId: string, isPrimary = false): Promise<StoreWarehouseType> {
    await this.stores.findById(storeId);
    const warehouse = await this.warehouses.findOne({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(StoreWarehouseEntity);
      let row = await repo.findOne({ where: { storeId, warehouseId } });
      if (!row) {
        row = repo.create({
          storeId,
          warehouseId,
          isPrimary: false,
        });
      }

      const makePrimary = isPrimary || row.isPrimary;
      if (makePrimary) {
        await repo.update({ storeId, isPrimary: true }, { isPrimary: false });
        row.isPrimary = true;
      }

      return repo.save(row);
    });

    await this.eventBus.publish({
      eventName: CoreEventName.StoreWarehouseUpdated,
      aggregateType: 'store_warehouse',
      aggregateId: `${storeId}:${warehouseId}`,
      data: {
        storeId,
        warehouseId,
        isPrimary: saved.isPrimary,
        action: 'linked',
      },
    });

    return toType(saved);
  }

  async unlink(storeId: string, warehouseId: string): Promise<StoreWarehouseType> {
    await this.stores.findById(storeId);
    const existing = await this.links.findOne({
      where: { storeId, warehouseId },
    });
    if (!existing) {
      throw new NotFoundException(`Store ${storeId} is not linked to warehouse ${warehouseId}`);
    }

    const wasPrimary = existing.isPrimary;
    await this.links.delete({ storeId, warehouseId });

    if (wasPrimary) {
      const next = await this.links.findOne({
        where: { storeId },
        order: { warehouseId: 'ASC' },
      });
      if (next) {
        next.isPrimary = true;
        await this.links.save(next);
      }
    }

    await this.eventBus.publish({
      eventName: CoreEventName.StoreWarehouseUpdated,
      aggregateType: 'store_warehouse',
      aggregateId: `${storeId}:${warehouseId}`,
      data: {
        storeId,
        warehouseId,
        isPrimary: existing.isPrimary,
        action: 'unlinked',
      },
    });

    return toType(existing);
  }

  /**
   * Ensure a newly created store has the default warehouse as primary.
   * Used by StoreCreated listener.
   */
  async ensureDefaultForStore(storeId: string): Promise<StoreWarehouseType | null> {
    await this.stores.findById(storeId);
    const existing = await this.links.count({ where: { storeId } });
    if (existing > 0) {
      const primary = await this.links.findOne({
        where: { storeId, isPrimary: true },
      });
      return primary ? toType(primary) : null;
    }

    const defaultWh = await this.warehouses.findOne({
      where: { isDefault: true },
    });
    if (!defaultWh) {
      return null;
    }
    return this.link(storeId, defaultWh.id, true);
  }
}
