import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { InventoryService } from './inventory.service';

type ItemRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
  createdAt: Date;
  updatedAt: Date;
};

type ReservationRow = {
  id: string;
  inventoryItemId: string;
  quantity: number;
  status: 'active' | 'released' | 'committed';
  reference: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WarehouseRow = {
  id: string;
  code: string;
  isActive: boolean;
  isDefault: boolean;
};

describe('InventoryService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  const defaultWarehouseId = 'wh-default';
  const secondaryWarehouseId = 'wh-nyc';
  let itemStore: ItemRow[];
  let reservationStore: ReservationRow[];
  let warehouseStore: WarehouseRow[];
  let service: InventoryService;
  let itemsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let reservationsRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let adjustmentsRepo: {
    find: ReturnType<typeof vi.fn>;
  };
  let warehousesRepo: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let storeWarehouses: {
    listWarehouseIdsForStore: ReturnType<typeof vi.fn>;
    assertWarehouseAllowedForStore: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    warehouseStore = [
      {
        id: defaultWarehouseId,
        code: 'DEFAULT',
        isActive: true,
        isDefault: true,
      },
      {
        id: secondaryWarehouseId,
        code: 'NYC-01',
        isActive: true,
        isDefault: false,
      },
    ];
    itemStore = [
      {
        id: 'item-1',
        variantId: 'var-1',
        warehouseId: defaultWarehouseId,
        quantityOnHand: 10,
        quantityReserved: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item-2',
        variantId: 'var-1',
        warehouseId: secondaryWarehouseId,
        quantityOnHand: 5,
        quantityReserved: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    reservationStore = [];

    itemsRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<ItemRow> } = {}) => {
        if (where?.warehouseId) {
          return itemStore.filter((r) => r.warehouseId === where.warehouseId);
        }
        return [...itemStore];
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<ItemRow> }) => {
        if (where.id) {
          return itemStore.find((r) => r.id === where.id) ?? null;
        }
        if (where.variantId && where.warehouseId) {
          return (
            itemStore.find(
              (r) =>
                r.variantId === where.variantId &&
                r.warehouseId === where.warehouseId,
            ) ?? null
          );
        }
        if (where.variantId) {
          return itemStore.find((r) => r.variantId === where.variantId) ?? null;
        }
        return null;
      }),
      create: vi.fn((data: Partial<ItemRow>) => ({
        id: 'item-new',
        quantityReserved: 0,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: ItemRow) => {
        const idx = itemStore.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          itemStore[idx] = { ...row };
          return itemStore[idx];
        }
        itemStore.push({ ...row });
        return row;
      }),
    };

    reservationsRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return reservationStore.find((r) => r.id === where.id) ?? null;
      }),
    };

    adjustmentsRepo = {
      find: vi.fn(async () => []),
    };

    warehousesRepo = {
      findOne: vi.fn(async ({ where }: { where: Partial<WarehouseRow> }) => {
        if (where.id) {
          return warehouseStore.find((w) => w.id === where.id) ?? null;
        }
        if (where.isDefault === true) {
          return warehouseStore.find((w) => w.isDefault) ?? null;
        }
        return null;
      }),
    };

    dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: { name: string }) => {
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
                      if (state.variantId) {
                        return (
                          itemStore.find(
                            (r) => r.variantId === state.variantId,
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
            if (entity.name === 'InventoryReservationEntity') {
              return {
                createQueryBuilder: () => {
                  const state: { id?: string } = {};
                  const qb = {
                    setLock: () => qb,
                    where: (_sql: string, params: Record<string, string>) => {
                      if (params.id) state.id = params.id;
                      return qb;
                    },
                    getOne: async () => {
                      if (!state.id) return null;
                      return (
                        reservationStore.find((r) => r.id === state.id) ?? null
                      );
                    },
                  };
                  return qb;
                },
              };
            }
            return {};
          },
          create: (_entity: unknown, data: Record<string, unknown>) => ({
            ...data,
          }),
          save: async (row: Record<string, unknown>) => {
            if ('quantityOnHand' in row && 'variantId' in row) {
              const item = row as unknown as ItemRow;
              if (!item.id) {
                item.id = `item-${itemStore.length + 1}`;
                item.createdAt = now;
                item.updatedAt = now;
              }
              const idx = itemStore.findIndex((r) => r.id === item.id);
              if (idx >= 0) {
                itemStore[idx] = { ...itemStore[idx], ...item };
                return itemStore[idx];
              }
              itemStore.push(item);
              return item;
            }
            if ('status' in row && 'quantity' in row) {
              const res = row as unknown as ReservationRow;
              if (!res.id) {
                res.id = `res-${reservationStore.length + 1}`;
                res.createdAt = now;
                res.updatedAt = now;
              }
              const idx = reservationStore.findIndex((r) => r.id === res.id);
              if (idx >= 0) {
                reservationStore[idx] = { ...reservationStore[idx], ...res };
                return reservationStore[idx];
              }
              reservationStore.push(res);
              return res;
            }
            // adjustment — ignore for unit tests
            return { id: 'adj-1', ...row };
          },
        };
        return fn(manager);
      }),
    };

    eventBus = {
      publish: vi.fn(async () => ({ listenerCount: 0, failures: [] })),
    };

    storeWarehouses = {
      listWarehouseIdsForStore: vi.fn(async () => [
        defaultWarehouseId,
        secondaryWarehouseId,
      ]),
      assertWarehouseAllowedForStore: vi.fn(async () => undefined),
    };

    service = new InventoryService(
      itemsRepo as never,
      reservationsRepo as never,
      adjustmentsRepo as never,
      warehousesRepo as never,
      storeWarehouses as never,
      dataSource as never,
      eventBus as never,
    );
  });

  it('findByVariantId uses default warehouse when warehouseId omitted', async () => {
    const item = await service.findByVariantId('var-1');
    expect(item.warehouseId).toBe(defaultWarehouseId);
    expect(item.quantityAvailable).toBe(8);
  });

  it('findByVariantId returns stock at an explicit warehouse', async () => {
    const item = await service.findByVariantId('var-1', secondaryWarehouseId);
    expect(item.id).toBe('item-2');
    expect(item.quantityOnHand).toBe(5);
    expect(item.quantityAvailable).toBe(5);
  });

  it('findAll filters by warehouseId', async () => {
    const items = await service.findAll(secondaryWarehouseId);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('item-2');
  });

  it('adjust increases on-hand at default warehouse and records via transaction', async () => {
    const item = await service.adjust({
      variantId: 'var-1',
      delta: 5,
      reason: 'restock',
    });
    expect(item.warehouseId).toBe(defaultWarehouseId);
    expect(item.quantityOnHand).toBe(15);
    expect(item.quantityAvailable).toBe(13);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryUpdated,
        aggregateType: 'inventory_item',
        data: expect.objectContaining({
          variantId: 'var-1',
          warehouseId: defaultWarehouseId,
          delta: 5,
          quantityOnHand: 15,
          reason: 'restock',
        }),
      }),
    );
  });

  it('adjust at secondary warehouse does not change default warehouse stock', async () => {
    await service.adjust({
      variantId: 'var-1',
      warehouseId: secondaryWarehouseId,
      delta: 3,
    });
    const defaultItem = await service.findByVariantId('var-1');
    const nycItem = await service.findByVariantId(
      'var-1',
      secondaryWarehouseId,
    );
    expect(defaultItem.quantityOnHand).toBe(10);
    expect(nycItem.quantityOnHand).toBe(8);
  });

  it('adjust rejects when result would go negative', async () => {
    await expect(
      service.adjust({ variantId: 'var-1', delta: -20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reserve reduces available and creates active reservation', async () => {
    const reservation = await service.reserve({
      variantId: 'var-1',
      quantity: 3,
      reference: 'cart-line-1',
    });
    expect(reservation.status).toBe('active');
    expect(reservation.quantity).toBe(3);
    const item = await service.findByVariantId('var-1');
    expect(item.quantityReserved).toBe(5);
    expect(item.quantityAvailable).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryReservationCreated,
        aggregateType: 'inventory_reservation',
        data: expect.objectContaining({
          quantity: 3,
          warehouseId: defaultWarehouseId,
          reference: 'cart-line-1',
          quantityReserved: 5,
          quantityAvailable: 5,
        }),
      }),
    );
  });

  it('reserve at secondary warehouse leaves default stock untouched', async () => {
    await service.reserve({
      variantId: 'var-1',
      warehouseId: secondaryWarehouseId,
      quantity: 2,
    });
    const defaultItem = await service.findByVariantId('var-1');
    const nycItem = await service.findByVariantId(
      'var-1',
      secondaryWarehouseId,
    );
    expect(defaultItem.quantityReserved).toBe(2);
    expect(nycItem.quantityReserved).toBe(2);
    expect(nycItem.quantityAvailable).toBe(3);
  });

  it('reserve rejects when insufficient available stock', async () => {
    await expect(
      service.reserve({ variantId: 'var-1', quantity: 9 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('release frees reserved quantity', async () => {
    const reservation = await service.reserve({
      variantId: 'var-1',
      quantity: 4,
    });
    eventBus.publish.mockClear();
    const released = await service.release(reservation.id);
    expect(released.status).toBe('released');
    const item = await service.findByVariantId('var-1');
    expect(item.quantityReserved).toBe(2);
    expect(item.quantityAvailable).toBe(8);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryReservationReleased,
        aggregateType: 'inventory_reservation',
        data: expect.objectContaining({
          reservationId: reservation.id,
          warehouseId: defaultWarehouseId,
          quantity: 4,
          quantityReserved: 2,
          quantityAvailable: 8,
        }),
      }),
    );
  });

  it('release rejects unknown reservation', async () => {
    await expect(service.release('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('commit deducts on-hand and marks reservation committed', async () => {
    const reservation = await service.reserve({
      variantId: 'var-1',
      quantity: 3,
    });
    eventBus.publish.mockClear();
    const committed = await service.commit(reservation.id);
    expect(committed.status).toBe('committed');
    const item = await service.findByVariantId('var-1');
    expect(item.quantityOnHand).toBe(7);
    expect(item.quantityReserved).toBe(2);
    expect(item.quantityAvailable).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.InventoryUpdated,
        data: expect.objectContaining({
          warehouseId: defaultWarehouseId,
          delta: -3,
          quantityOnHand: 7,
          reason: `reservation_committed:${reservation.id}`,
        }),
      }),
    );
  });

  it('create at explicit warehouse keeps composite uniqueness per location', async () => {
    const created = await service.create({
      variantId: 'var-2',
      warehouseId: secondaryWarehouseId,
      quantityOnHand: 4,
    });
    expect(created.warehouseId).toBe(secondaryWarehouseId);
    expect(created.variantId).toBe('var-2');
    expect(created.quantityOnHand).toBe(4);
  });

  it('reserveForStore prefers primary warehouse when stock is available', async () => {
    const reservation = await service.reserveForStore({
      variantId: 'var-1',
      storeId: 'store-a',
      quantity: 2,
    });
    expect(reservation.status).toBe('active');
    const item = await service.findByVariantId('var-1');
    expect(item.quantityReserved).toBe(4);
    expect(storeWarehouses.listWarehouseIdsForStore).toHaveBeenCalledWith(
      'store-a',
    );
  });

  it('reserveForStore falls back to next allowed warehouse when primary lacks stock', async () => {
    storeWarehouses.listWarehouseIdsForStore = vi.fn(async () => [
      defaultWarehouseId,
      secondaryWarehouseId,
    ]);
    // Exhaust default available (onHand 10, reserved 2 → available 8)
    const defaultItem = itemStore.find(
      (r) =>
        r.variantId === 'var-1' && r.warehouseId === defaultWarehouseId,
    )!;
    defaultItem.quantityReserved = 10;

    const reservation = await service.reserveForStore({
      variantId: 'var-1',
      storeId: 'store-a',
      quantity: 2,
    });
    expect(reservation.status).toBe('active');
    const nyc = await service.findByVariantId('var-1', secondaryWarehouseId);
    expect(nyc.quantityReserved).toBe(2);
  });

  it('reserveForStore rejects when store has no warehouses', async () => {
    storeWarehouses.listWarehouseIdsForStore = vi.fn(async () => []);
    await expect(
      service.reserveForStore({
        variantId: 'var-1',
        storeId: 'store-empty',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reserveForStore does not use warehouses outside the allow-list', async () => {
    storeWarehouses.listWarehouseIdsForStore = vi.fn(async () => [
      secondaryWarehouseId,
    ]);
    const reservation = await service.reserveForStore({
      variantId: 'var-1',
      storeId: 'store-nyc-only',
      quantity: 1,
    });
    expect(reservation.status).toBe('active');
    const defaultItem = await service.findByVariantId('var-1');
    const nyc = await service.findByVariantId('var-1', secondaryWarehouseId);
    expect(defaultItem.quantityReserved).toBe(2);
    expect(nyc.quantityReserved).toBe(1);
  });
});
