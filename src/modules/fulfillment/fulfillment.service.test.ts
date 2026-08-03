import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { InventoryItemEntity } from '../inventory/public';
import { FulfillmentLineEntity } from './entities/fulfillment-line.entity';
import { FulfillmentPackageEntity } from './entities/fulfillment-package.entity';
import { FulfillmentEntity } from './entities/fulfillment.entity';
import { FulfillmentService } from './fulfillment.service';

type ItemRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantityOnHand: number;
  quantityReserved: number;
};

type FulfillmentRow = {
  id: string;
  orderId: string;
  warehouseId: string;
  status: 'pending' | 'picked' | 'packed' | 'shipped' | 'cancelled';
  notes: string | null;
  trackingNumber: string | null;
  pickedAt: Date | null;
  packedAt: Date | null;
  shippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  fulfillmentId: string;
  orderLineId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type PackageRow = {
  id: string;
  fulfillmentId: string;
  trackingNumber: string | null;
  carrierCode: string | null;
  labelUrl: string | null;
  weightGrams: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderRow = {
  id: string;
  status: string;
  customerId: string | null;
};

type OrderLineRow = {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
};

type WarehouseRow = {
  id: string;
  isActive: boolean;
};

describe('FulfillmentService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  const orderId = '11111111-1111-1111-1111-111111111111';
  const warehouseId = '22222222-2222-2222-2222-222222222222';
  const orderLineA = '33333333-3333-3333-3333-333333333333';
  const orderLineB = '44444444-4444-4444-4444-444444444444';
  const variantA = '55555555-5555-5555-5555-555555555555';
  const variantB = '66666666-6666-6666-6666-666666666666';
  const customerId = '77777777-7777-7777-7777-777777777777';

  let fulfillmentStore: FulfillmentRow[];
  let lineStore: LineRow[];
  let packageStore: PackageRow[];
  let itemStore: ItemRow[];
  let orderStore: OrderRow[];
  let orderLineStore: OrderLineRow[];
  let warehouseStore: WarehouseRow[];
  let service: FulfillmentService;
  let fulfillmentRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let warehousesRepo: { findOne: ReturnType<typeof vi.fn> };
  let ordersRepo: { findOne: ReturnType<typeof vi.fn> };
  let orderLinesRepo: { find: ReturnType<typeof vi.fn> };
  let ordersService: { updateStatus: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fulfillmentStore = [];
    lineStore = [];
    packageStore = [];
    itemStore = [
      {
        id: 'inv-a',
        variantId: variantA,
        warehouseId,
        quantityOnHand: 5,
        quantityReserved: 0,
      },
      {
        id: 'inv-b',
        variantId: variantB,
        warehouseId,
        quantityOnHand: 3,
        quantityReserved: 0,
      },
    ];
    orderStore = [{ id: orderId, status: 'confirmed', customerId }];
    orderLineStore = [
      { id: orderLineA, orderId, variantId: variantA, quantity: 2 },
      { id: orderLineB, orderId, variantId: variantB, quantity: 1 },
    ];
    warehouseStore = [{ id: warehouseId, isActive: true }];

    const hydrate = (f: FulfillmentRow) => ({
      ...f,
      lines: lineStore.filter((l) => l.fulfillmentId === f.id),
      packages: packageStore.filter((p) => p.fulfillmentId === f.id),
    });

    fulfillmentRepo = {
      find: vi.fn(async (opts: { where?: unknown } = {}) => {
        const where = opts.where;
        let rows = [...fulfillmentStore];
        if (Array.isArray(where)) {
          const statuses = new Set(
            where.map((w: { status?: string }) => w.status),
          );
          const oid = (where[0] as { orderId?: string })?.orderId;
          rows = rows.filter(
            (f) => f.orderId === oid && statuses.has(f.status),
          );
        } else if (where && typeof where === 'object') {
          const w = where as {
            status?: string;
            orderId?: string;
          };
          if (w.status) rows = rows.filter((f) => f.status === w.status);
          if (w.orderId) rows = rows.filter((f) => f.orderId === w.orderId);
        }
        return rows.map(hydrate);
      }),
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        const f = fulfillmentStore.find((r) => r.id === where.id);
        return f ? hydrate(f) : null;
      }),
    };

    warehousesRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return warehouseStore.find((w) => w.id === where.id) ?? null;
      }),
    };

    ordersRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
        return orderStore.find((o) => o.id === where.id) ?? null;
      }),
    };

    orderLinesRepo = {
      find: vi.fn(
        async ({
          where,
        }: {
          where: { orderId: string; id?: unknown };
        }) => {
          let rows = orderLineStore.filter((l) => l.orderId === where.orderId);
          if (where.id && typeof where.id === 'object' && '_value' in where.id) {
            const ids = (where.id as { _value: string[] })._value;
            rows = rows.filter((l) => ids.includes(l.id));
          } else if (
            where.id &&
            typeof where.id === 'object' &&
            'value' in (where.id as object)
          ) {
            // TypeORM In() operator
            const ids = Object.values(where.id as Record<string, string[]>).flat();
            rows = rows.filter((l) => ids.includes(l.id));
          }
          return rows;
        },
      ),
    };

    ordersService = {
      updateStatus: vi.fn(async ({ id, status }: { id: string; status: string }) => {
        const order = orderStore.find((o) => o.id === id);
        if (order) order.status = status;
        return { id, status };
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
                  if ('orderLineId' in row && 'fulfillmentId' in row) {
                    const line: LineRow = {
                      id: (row.id as string) ?? `fline-${lineStore.length + 1}`,
                      fulfillmentId: row.fulfillmentId as string,
                      orderLineId: row.orderLineId as string,
                      variantId: row.variantId as string,
                      quantity: row.quantity as number,
                      createdAt: now,
                      updatedAt: now,
                    };
                    lineStore.push(line);
                    return line;
                  }
                  if ('fulfillmentId' in row && !('orderLineId' in row)) {
                    const pkg: PackageRow = {
                      id: (row.id as string) ?? `pkg-${packageStore.length + 1}`,
                      fulfillmentId: row.fulfillmentId as string,
                      trackingNumber: (row.trackingNumber as string | null) ?? null,
                      carrierCode: (row.carrierCode as string | null) ?? null,
                      labelUrl: (row.labelUrl as string | null) ?? null,
                      weightGrams: (row.weightGrams as number | null) ?? null,
                      createdAt: now,
                      updatedAt: now,
                    };
                    packageStore.push(pkg);
                    return pkg;
                  }
                  return row;
                },
              );
            }
            const row = entityOrEntities as Record<string, unknown>;
            if ('orderId' in row && 'warehouseId' in row && !('orderLineId' in row)) {
              const f: FulfillmentRow = {
                id: (row.id as string) ?? `ff-${fulfillmentStore.length + 1}`,
                orderId: row.orderId as string,
                warehouseId: row.warehouseId as string,
                status: (row.status as FulfillmentRow['status']) ?? 'pending',
                notes: (row.notes as string | null) ?? null,
                trackingNumber: (row.trackingNumber as string | null) ?? null,
                pickedAt: (row.pickedAt as Date | null) ?? null,
                packedAt: (row.packedAt as Date | null) ?? null,
                shippedAt: (row.shippedAt as Date | null) ?? null,
                createdAt: now,
                updatedAt: now,
              };
              const idx = fulfillmentStore.findIndex((x) => x.id === f.id);
              if (idx >= 0) {
                fulfillmentStore[idx] = { ...fulfillmentStore[idx], ...f };
                return fulfillmentStore[idx];
              }
              fulfillmentStore.push(f);
              return f;
            }
            return row;
          },
          find: async (
            Entity: { name: string },
            opts: { where: { fulfillmentId: string } },
          ) => {
            if (Entity.name === 'FulfillmentLineEntity') {
              return lineStore.filter(
                (l) => l.fulfillmentId === opts.where.fulfillmentId,
              );
            }
            if (Entity.name === 'FulfillmentPackageEntity') {
              return packageStore.filter(
                (p) => p.fulfillmentId === opts.where.fulfillmentId,
              );
            }
            return [];
          },
          findOne: async (
            Entity: { name: string },
            opts: { where: { id: string } },
          ) => {
            if (Entity.name === 'OrderEntity') {
              return orderStore.find((o) => o.id === opts.where.id) ?? null;
            }
            return null;
          },
          getRepository: (entity: { name: string }) => {
            if (entity.name === 'FulfillmentEntity') {
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
                      return (
                        fulfillmentStore.find((f) => f.id === state.id) ?? null
                      );
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
                  } = {};
                  const qb = {
                    setLock: () => qb,
                    where: (_sql: string, params: Record<string, string>) => {
                      if (params.variantId) state.variantId = params.variantId;
                      if (params.warehouseId) {
                        state.warehouseId = params.warehouseId;
                      }
                      return qb;
                    },
                    getOne: async () => {
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

    service = new FulfillmentService(
      fulfillmentRepo as never,
      warehousesRepo as never,
      ordersRepo as never,
      orderLinesRepo as never,
      ordersService as never,
      dataSource as never,
      eventBus as never,
    );

    void InventoryItemEntity;
    void FulfillmentEntity;
    void FulfillmentLineEntity;
    void FulfillmentPackageEntity;
  });

  async function createFullOrderFulfillment() {
    return service.create({
      orderId,
      warehouseId,
      lines: [
        { orderLineId: orderLineA, quantity: 2 },
        { orderLineId: orderLineB, quantity: 1 },
      ],
    });
  }

  it('create → pick → pack → ship publishes ShipmentCreated and fulfills order', async () => {
    const created = await createFullOrderFulfillment();
    expect(created.status).toBe('pending');
    expect(created.lines).toHaveLength(2);

    const picked = await service.pick(created.id);
    expect(picked.status).toBe('picked');
    expect(picked.pickedAt).toBeTruthy();

    const packed = await service.pack(created.id, {
      packages: [{ trackingNumber: '1Z999', carrierCode: 'ups', weightGrams: 500 }],
    });
    expect(packed.status).toBe('packed');
    expect(packed.packages).toHaveLength(1);

    const shipped = await service.ship(created.id);
    expect(shipped.status).toBe('shipped');
    expect(shipped.trackingNumber).toBe('1Z999');

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.ShipmentCreated,
        data: expect.objectContaining({
          fulfillmentId: created.id,
          orderId,
          warehouseId,
          trackingNumber: '1Z999',
          customerId,
          lineCount: 2,
        }),
      }),
    );
    expect(ordersService.updateStatus).toHaveBeenCalledWith({
      id: orderId,
      status: 'fulfilled',
    });
  });

  it('supports partial shipment then fulfills when remaining lines ship', async () => {
    const first = await service.create({
      orderId,
      warehouseId,
      lines: [{ orderLineId: orderLineA, quantity: 2 }],
    });
    await service.pick(first.id);
    await service.pack(first.id);
    await service.ship(first.id, { trackingNumber: 'PARTIAL-1' });

    expect(ordersService.updateStatus).not.toHaveBeenCalled();

    const second = await service.create({
      orderId,
      warehouseId,
      lines: [{ orderLineId: orderLineB, quantity: 1 }],
    });
    await service.pick(second.id);
    await service.pack(second.id);
    await service.ship(second.id, { trackingNumber: 'PARTIAL-2' });

    expect(ordersService.updateStatus).toHaveBeenCalledWith({
      id: orderId,
      status: 'fulfilled',
    });
  });

  it('rejects over-allocation of order line qty', async () => {
    await service.create({
      orderId,
      warehouseId,
      lines: [{ orderLineId: orderLineA, quantity: 2 }],
    });

    await expect(
      service.create({
        orderId,
        warehouseId,
        lines: [{ orderLineId: orderLineA, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects create when order is not confirmed', async () => {
    orderStore[0]!.status = 'pending';
    await expect(
      service.create({
        orderId,
        warehouseId,
        lines: [{ orderLineId: orderLineA, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects ship when warehouse has no inventory row for variant', async () => {
    itemStore = itemStore.filter((i) => i.variantId !== variantB);
    const created = await createFullOrderFulfillment();
    await service.pick(created.id);
    await service.pack(created.id);
    await expect(service.ship(created.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cancel only from pending/picked', async () => {
    const created = await createFullOrderFulfillment();
    const cancelled = await service.cancel(created.id);
    expect(cancelled.status).toBe('cancelled');

    const again = await service.create({
      orderId,
      warehouseId,
      lines: [{ orderLineId: orderLineA, quantity: 1 }],
    });
    await service.pick(again.id);
    await service.pack(again.id);
    await expect(service.cancel(again.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('findById throws when missing', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
