import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { InventoryAdjustmentEntity } from './entities/inventory-adjustment.entity';
import { InventoryItemEntity } from './entities/inventory-item.entity';
import { StockTransferLineEntity } from './entities/stock-transfer-line.entity';
import { StockTransferEntity } from './entities/stock-transfer.entity';
import { StockTransferService } from './stock-transfer.service';

type ItemRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  createdAt: Date;
  updatedAt: Date;
};

type TransferRow = {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: 'draft' | 'in_transit' | 'received' | 'cancelled';
  notes: string | null;
  shippedAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  transferId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type WarehouseRow = {
  id: string;
  isActive: boolean;
};

describe('StockTransferService (unit)', () => {
  const now = new Date('2026-08-03T15:00:00Z');
  const fromWh = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const toWh = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const variantId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let itemStore: ItemRow[];
  let transferStore: TransferRow[];
  let lineStore: LineRow[];
  let warehouseStore: WarehouseRow[];
  let service: StockTransferService;
  let transfersRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let warehousesRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    warehouseStore = [
      { id: fromWh, isActive: true },
      { id: toWh, isActive: true },
    ];
    itemStore = [
      {
        id: 'item-src',
        variantId,
        warehouseId: fromWh,
        quantityOnHand: 10,
        quantityReserved: 2,
        createdAt: now,
        updatedAt: now,
      },
    ];
    transferStore = [];
    lineStore = [];

    transfersRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<TransferRow> } = {}) => {
        const rows = where?.status
          ? transferStore.filter((t) => t.status === where.status)
          : [...transferStore];
        return rows.map((t) => ({
          ...t,
          lines: lineStore.filter((l) => l.transferId === t.id),
        }));
      }),
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        const t = transferStore.find((r) => r.id === where.id);
        if (!t) return null;
        return {
          ...t,
          lines: lineStore.filter((l) => l.transferId === t.id),
        };
      }),
    };

    warehousesRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return warehouseStore.find((w) => w.id === where.id) ?? null;
      }),
    };

    dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          create: (_Entity: unknown, data: Record<string, unknown>) => ({
            ...data,
          }),
          save: async (entityOrEntities: unknown) => {
            if (Array.isArray(entityOrEntities)) {
              return entityOrEntities.map((row: LineRow & TransferRow & ItemRow) => {
                if ('transferId' in row && 'variantId' in row && 'quantity' in row) {
                  const line: LineRow = {
                    id: row.id ?? `line-${lineStore.length + 1}`,
                    transferId: row.transferId,
                    variantId: row.variantId,
                    quantity: row.quantity,
                    createdAt: now,
                    updatedAt: now,
                  };
                  lineStore.push(line);
                  return line;
                }
                return row;
              });
            }
            const row = entityOrEntities as Record<string, unknown>;
            if (
              'fromWarehouseId' in row &&
              'toWarehouseId' in row &&
              !('variantId' in row && 'quantityOnHand' in row)
            ) {
              const transfer: TransferRow = {
                id: (row.id as string) ?? 'xfer-1',
                fromWarehouseId: row.fromWarehouseId as string,
                toWarehouseId: row.toWarehouseId as string,
                status: (row.status as TransferRow['status']) ?? 'draft',
                notes: (row.notes as string | null) ?? null,
                shippedAt: (row.shippedAt as Date | null) ?? null,
                receivedAt: (row.receivedAt as Date | null) ?? null,
                createdAt: now,
                updatedAt: now,
              };
              const idx = transferStore.findIndex((t) => t.id === transfer.id);
              if (idx >= 0) {
                transferStore[idx] = { ...transferStore[idx], ...transfer };
                return transferStore[idx];
              }
              transferStore.push(transfer);
              return transfer;
            }
            if ('quantityOnHand' in row && 'variantId' in row) {
              const item = row as unknown as ItemRow;
              const idx = itemStore.findIndex((i) => i.id === item.id);
              if (idx >= 0) {
                itemStore[idx] = { ...item };
                return itemStore[idx];
              }
              if (!item.id) {
                item.id = `item-${itemStore.length + 1}`;
              }
              itemStore.push({ ...item, createdAt: now, updatedAt: now });
              return item;
            }
            // adjustments — ignore storage
            return row;
          },
          find: async (
            Entity: { name: string },
            opts: {
              where: { transferId: string };
              order?: { variantId: string };
            },
          ) => {
            if (Entity.name === 'StockTransferLineEntity') {
              const lines = lineStore.filter((l) => l.transferId === opts.where.transferId);
              return [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
            }
            return [];
          },
          getRepository: (entity: { name: string }) => {
            if (entity.name === 'StockTransferEntity') {
              return {
                createQueryBuilder: () => {
                  const state: { id?: string } = {};
                  const qb = {
                    setLock: () => qb,
                    where: (_sql: string, params: { id: string }) => {
                      state.id = params.id;
                      return qb;
                    },
                    getOne: async () => {
                      if (!state.id) return null;
                      return transferStore.find((t) => t.id === state.id) ?? null;
                    },
                  };
                  return qb;
                },
              };
            }
            if (entity.name === 'InventoryItemEntity') {
              return {
                createQueryBuilder: () => {
                  const state: {
                    variantId?: string;
                    warehouseId?: string;
                    id?: string;
                  } = {};
                  const qb = {
                    setLock: () => qb,
                    where: (_sql: string, params: Record<string, string>) => {
                      if (params.variantId) state.variantId = params.variantId;
                      if (params.warehouseId) {
                        state.warehouseId = params.warehouseId;
                      }
                      if (params.id) state.id = params.id;
                      return qb;
                    },
                    getOne: async () => {
                      if (state.id) {
                        return itemStore.find((r) => r.id === state.id) ?? null;
                      }
                      if (state.variantId && state.warehouseId) {
                        return (
                          itemStore.find(
                            (r) =>
                              r.variantId === state.variantId &&
                              r.warehouseId === state.warehouseId,
                          ) ?? null
                        );
                      }
                      return null;
                    },
                  };
                  return qb;
                },
              };
            }
            return {};
          },
        };
        return fn(manager);
      }),
    };

    eventBus = { publish: vi.fn(async () => undefined) };

    const storeWarehouses = {
      assertTransferAllowed: vi.fn(async () => undefined),
    };

    service = new StockTransferService(
      transfersRepo as never,
      warehousesRepo as never,
      storeWarehouses as never,
      dataSource as never,
      eventBus as never,
    );

    // Ensure entity.name checks work in mocks
    void InventoryItemEntity;
    void StockTransferEntity;
    void StockTransferLineEntity;
    void InventoryAdjustmentEntity;
  });

  it('creates a draft transfer without moving stock', async () => {
    const result = await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 3 }],
      notes: 'move to NYC',
    });

    expect(result.status).toBe('draft');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.quantity).toBe(3);
    expect(itemStore[0]?.quantityOnHand).toBe(10);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StockTransferCreated,
      }),
    );
  });

  it('rejects same from/to warehouse', async () => {
    await expect(
      service.create({
        fromWarehouseId: fromWh,
        toWarehouseId: fromWh,
        lines: [{ variantId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ships deducts source available stock and sets in_transit', async () => {
    await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 3 }],
    });

    const shipped = await service.ship('xfer-1');
    expect(shipped.status).toBe('in_transit');
    expect(shipped.shippedAt).toBeTruthy();
    expect(itemStore[0]?.quantityOnHand).toBe(7);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryUpdated,
        data: expect.objectContaining({ delta: -3, warehouseId: fromWh }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StockTransferShipped,
      }),
    );
  });

  it('rejects ship when available stock is insufficient', async () => {
    await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 9 }], // available = 8
    });

    await expect(service.ship('xfer-1')).rejects.toBeInstanceOf(ConflictException);
    expect(itemStore[0]?.quantityOnHand).toBe(10);
  });

  it('receives credits destination and completes transfer', async () => {
    await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 4 }],
    });
    await service.ship('xfer-1');
    eventBus.publish.mockClear();

    const received = await service.receive('xfer-1');
    expect(received.status).toBe('received');
    expect(received.receivedAt).toBeTruthy();

    const dest = itemStore.find((i) => i.variantId === variantId && i.warehouseId === toWh);
    expect(dest?.quantityOnHand).toBe(4);
    expect(itemStore[0]?.quantityOnHand).toBe(6);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StockTransferReceived,
      }),
    );
  });

  it('cancels draft only', async () => {
    await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 1 }],
    });
    const cancelled = await service.cancel('xfer-1');
    expect(cancelled.status).toBe('cancelled');

    await service.create({
      fromWarehouseId: fromWh,
      toWarehouseId: toWh,
      lines: [{ variantId, quantity: 1 }],
    });
    // force overwrite id for second create mock — last transfer is still xfer-1
    // ship then cancel should fail
    transferStore[0]!.status = 'in_transit';
    await expect(service.cancel('xfer-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findById throws when missing', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create rejects when store warehouse guard fails', async () => {
    const storeWarehouses = {
      assertTransferAllowed: vi
        .fn()
        .mockRejectedValue(
          new BadRequestException(
            `Warehouses ${fromWh} and ${toWh} do not share a store association`,
          ),
        ),
    };
    const guarded = new StockTransferService(
      transfersRepo as never,
      warehousesRepo as never,
      storeWarehouses as never,
      dataSource as never,
      eventBus as never,
    );
    await expect(
      guarded.create({
        fromWarehouseId: fromWh,
        toWarehouseId: toWh,
        lines: [{ variantId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
