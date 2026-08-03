import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import {
  InventoryAdjustmentEntity,
  InventoryItemEntity,
} from '../inventory/public';
import { PurchaseOrderLineEntity } from './entities/purchase-order-line.entity';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { PurchaseOrderService } from './purchase-order.service';

type ItemRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  createdAt: Date;
  updatedAt: Date;
};

type PoRow = {
  id: string;
  supplierId: string;
  warehouseId: string;
  status: 'draft' | 'received' | 'cancelled';
  notes: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  purchaseOrderId: string;
  variantId: string;
  quantity: number;
  quantityReceived: number;
  createdAt: Date;
  updatedAt: Date;
};

type SupplierRow = {
  id: string;
  isActive: boolean;
};

type WarehouseRow = {
  id: string;
  isActive: boolean;
};

describe('PurchaseOrderService (unit)', () => {
  const now = new Date('2026-08-03T16:00:00Z');
  const supplierId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const warehouseId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const variantId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let itemStore: ItemRow[];
  let poStore: PoRow[];
  let lineStore: LineRow[];
  let supplierStore: SupplierRow[];
  let warehouseStore: WarehouseRow[];
  let service: PurchaseOrderService;
  let poRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let suppliersRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let warehousesRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    supplierStore = [{ id: supplierId, isActive: true }];
    warehouseStore = [{ id: warehouseId, isActive: true }];
    itemStore = [];
    poStore = [];
    lineStore = [];

    poRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<PoRow> } = {}) => {
        const rows = where?.status
          ? poStore.filter((p) => p.status === where.status)
          : [...poStore];
        return rows.map((p) => ({
          ...p,
          lines: lineStore.filter((l) => l.purchaseOrderId === p.id),
        }));
      }),
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = poStore.find((r) => r.id === where.id);
        if (!p) return null;
        return {
          ...p,
          lines: lineStore.filter((l) => l.purchaseOrderId === p.id),
        };
      }),
    };

    suppliersRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return supplierStore.find((s) => s.id === where.id) ?? null;
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
              return (entityOrEntities as Array<Record<string, unknown>>).map(
                (row) => {
                  if (
                    'purchaseOrderId' in row &&
                    'variantId' in row &&
                    'quantity' in row &&
                    !('quantityOnHand' in row)
                  ) {
                    const line: LineRow = {
                      id: (row.id as string) ?? `line-${lineStore.length + 1}`,
                      purchaseOrderId: row.purchaseOrderId as string,
                      variantId: row.variantId as string,
                      quantity: row.quantity as number,
                      quantityReceived: (row.quantityReceived as number) ?? 0,
                      createdAt: now,
                      updatedAt: now,
                    };
                    const existing = lineStore.findIndex(
                      (l) => l.id === line.id,
                    );
                    if (existing >= 0) {
                      lineStore[existing] = line;
                      return line;
                    }
                    lineStore.push(line);
                    return line;
                  }
                  return row;
                },
              );
            }
            const row = entityOrEntities as Record<string, unknown>;
            if (
              'supplierId' in row &&
              'warehouseId' in row &&
              !('variantId' in row && 'quantityOnHand' in row)
            ) {
              const po: PoRow = {
                id: (row.id as string) ?? 'po-1',
                supplierId: row.supplierId as string,
                warehouseId: row.warehouseId as string,
                status: (row.status as PoRow['status']) ?? 'draft',
                notes: (row.notes as string | null) ?? null,
                receivedAt: (row.receivedAt as Date | null) ?? null,
                createdAt: now,
                updatedAt: now,
              };
              const idx = poStore.findIndex((p) => p.id === po.id);
              if (idx >= 0) {
                poStore[idx] = { ...poStore[idx], ...po };
                return poStore[idx];
              }
              poStore.push(po);
              return po;
            }
            if (
              'purchaseOrderId' in row &&
              'variantId' in row &&
              'quantity' in row &&
              !('quantityOnHand' in row)
            ) {
              const line = row as unknown as LineRow;
              const idx = lineStore.findIndex((l) => l.id === line.id);
              if (idx >= 0) {
                lineStore[idx] = { ...lineStore[idx], ...line };
                return lineStore[idx];
              }
              if (!line.id) {
                line.id = `line-${lineStore.length + 1}`;
              }
              lineStore.push({
                ...line,
                quantityReceived: line.quantityReceived ?? 0,
                createdAt: now,
                updatedAt: now,
              });
              return line;
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
            return row;
          },
          find: async (
            Entity: { name: string },
            opts: {
              where: { purchaseOrderId: string };
              order?: { variantId: string };
            },
          ) => {
            if (Entity.name === 'PurchaseOrderLineEntity') {
              const lines = lineStore.filter(
                (l) => l.purchaseOrderId === opts.where.purchaseOrderId,
              );
              return [...lines].sort((a, b) =>
                a.variantId.localeCompare(b.variantId),
              );
            }
            return [];
          },
          getRepository: (entity: { name: string }) => {
            if (entity.name === 'PurchaseOrderEntity') {
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
                      return poStore.find((p) => p.id === state.id) ?? null;
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
                        return (
                          itemStore.find((r) => r.id === state.id) ?? null
                        );
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

    service = new PurchaseOrderService(
      poRepo as never,
      suppliersRepo as never,
      warehousesRepo as never,
      dataSource as never,
      eventBus as never,
    );

    void InventoryItemEntity;
    void PurchaseOrderEntity;
    void PurchaseOrderLineEntity;
    void InventoryAdjustmentEntity;
  });

  it('creates a draft PO without moving stock', async () => {
    const result = await service.create({
      supplierId,
      warehouseId,
      lines: [{ variantId, quantity: 5 }],
      notes: 'restock',
    });

    expect(result.status).toBe('draft');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.quantity).toBe(5);
    expect(result.lines[0]?.quantityReceived).toBe(0);
    expect(itemStore).toHaveLength(0);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.PurchaseOrderCreated,
      }),
    );
  });

  it('rejects inactive supplier', async () => {
    supplierStore[0]!.isActive = false;
    await expect(
      service.create({
        supplierId,
        warehouseId,
        lines: [{ variantId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('receive credits warehouse stock and completes PO', async () => {
    await service.create({
      supplierId,
      warehouseId,
      lines: [{ variantId, quantity: 7 }],
    });
    eventBus.publish.mockClear();

    const received = await service.receive('po-1');
    expect(received.status).toBe('received');
    expect(received.receivedAt).toBeTruthy();
    expect(received.lines[0]?.quantityReceived).toBe(7);

    const item = itemStore.find(
      (i) => i.variantId === variantId && i.warehouseId === warehouseId,
    );
    expect(item?.quantityOnHand).toBe(7);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryUpdated,
        data: expect.objectContaining({
          delta: 7,
          warehouseId,
          reason: 'po_receive:po-1',
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.PurchaseOrderReceived,
      }),
    );
  });

  it('cancels draft only', async () => {
    await service.create({
      supplierId,
      warehouseId,
      lines: [{ variantId, quantity: 1 }],
    });
    const cancelled = await service.cancel('po-1');
    expect(cancelled.status).toBe('cancelled');

    poStore[0]!.status = 'received';
    await expect(service.cancel('po-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('findById throws when missing', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
