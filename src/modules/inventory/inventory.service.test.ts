import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InventoryService } from './inventory.service';

type ItemRow = {
  id: string;
  variantId: string;
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

describe('InventoryService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let itemStore: ItemRow[];
  let reservationStore: ReservationRow[];
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
  let dataSource: { transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    itemStore = [
      {
        id: 'item-1',
        variantId: 'var-1',
        quantityOnHand: 10,
        quantityReserved: 2,
        createdAt: now,
        updatedAt: now,
      },
    ];
    reservationStore = [];

    itemsRepo = {
      find: vi.fn(async () => [...itemStore]),
      findOne: vi.fn(async ({ where }: { where: Partial<ItemRow> }) => {
        if (where.id) {
          return itemStore.find((r) => r.id === where.id) ?? null;
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

    dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entity: { name: string }) => {
            if (entity.name === 'InventoryItemEntity') {
              return {
                createQueryBuilder: () => {
                  const state: { variantId?: string; id?: string } = {};
                  const qb = {
                    setLock: () => qb,
                    where: (_sql: string, params: Record<string, string>) => {
                      if (params.variantId) state.variantId = params.variantId;
                      if (params.id) state.id = params.id;
                      return qb;
                    },
                    getOne: async () => {
                      if (state.id) {
                        return (
                          itemStore.find((r) => r.id === state.id) ?? null
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

    service = new InventoryService(
      itemsRepo as never,
      reservationsRepo as never,
      adjustmentsRepo as never,
      dataSource as never,
    );
  });

  it('findByVariantId returns available = onHand - reserved', async () => {
    const item = await service.findByVariantId('var-1');
    expect(item.quantityAvailable).toBe(8);
  });

  it('adjust increases on-hand and records via transaction', async () => {
    const item = await service.adjust({
      variantId: 'var-1',
      delta: 5,
      reason: 'restock',
    });
    expect(item.quantityOnHand).toBe(15);
    expect(item.quantityAvailable).toBe(13);
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
    const released = await service.release(reservation.id);
    expect(released.status).toBe('released');
    const item = await service.findByVariantId('var-1');
    expect(item.quantityReserved).toBe(2);
    expect(item.quantityAvailable).toBe(8);
  });

  it('release rejects unknown reservation', async () => {
    await expect(service.release('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
