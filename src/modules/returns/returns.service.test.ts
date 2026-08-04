import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { OrderLineEntity } from '../order/entities/order-line.entity';
import { ReturnLineEntity } from './entities/return-line.entity';
import { ReturnEntity } from './entities/return.entity';
import { ReturnsService } from './returns.service';
import type { ReturnStatus } from './return-status';

type ReturnRow = {
  id: string;
  orderId: string;
  warehouseId: string;
  status: ReturnStatus;
  resolution: 'refund' | 'exchange';
  reason: string | null;
  notes: string | null;
  paymentId: string | null;
  replacementOrderId: string | null;
  refundAmountMinor: string | null;
  approvedAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  returnId: string;
  orderLineId: string;
  variantId: string;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderRow = {
  id: string;
  status: string;
  customerId: string | null;
  currencyCode: string;
};

type OrderLineRow = {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: string;
};

type WarehouseRow = {
  id: string;
  isActive: boolean;
};

type PaymentRow = {
  id: string;
  orderId: string;
  status: string;
  amountMinor: string;
  currencyCode: string;
};

describe('ReturnsService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  const orderId = '11111111-1111-1111-1111-111111111111';
  const warehouseId = '22222222-2222-2222-2222-222222222222';
  const orderLineA = '33333333-3333-3333-3333-333333333333';
  const variantA = '55555555-5555-5555-5555-555555555555';
  const paymentId = '88888888-8888-8888-8888-888888888888';
  const customerId = '77777777-7777-7777-7777-777777777777';

  let returnStore: ReturnRow[];
  let lineStore: LineRow[];
  let orderStore: OrderRow[];
  let orderLineStore: OrderLineRow[];
  let warehouseStore: WarehouseRow[];
  let paymentStore: PaymentRow[];
  let stubOrders: OrderRow[];
  let service: ReturnsService;
  let inventory: { adjust: ReturnType<typeof vi.fn> };
  let payments: {
    findByOrderId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  function attachLines(row: ReturnRow): ReturnEntity {
    return Object.assign(new ReturnEntity(), row, {
      lines: lineStore
        .filter((l) => l.returnId === row.id)
        .map((l) => Object.assign(new ReturnLineEntity(), l)),
    });
  }

  beforeEach(() => {
    returnStore = [];
    lineStore = [];
    stubOrders = [];
    orderStore = [
      {
        id: orderId,
        status: 'fulfilled',
        customerId,
        currencyCode: 'USD',
      },
    ];
    orderLineStore = [
      {
        id: orderLineA,
        orderId,
        variantId: variantA,
        quantity: 2,
        unitPriceMinor: '1000',
      },
    ];
    warehouseStore = [{ id: warehouseId, isActive: true }];
    paymentStore = [
      {
        id: paymentId,
        orderId,
        status: 'captured',
        amountMinor: '2000',
        currencyCode: 'USD',
      },
    ];

    inventory = { adjust: vi.fn().mockResolvedValue({}) };
    payments = {
      findByOrderId: vi.fn(async (oid: string) => paymentStore.filter((p) => p.orderId === oid)),
      findById: vi.fn(async (id: string) => {
        const row = paymentStore.find((p) => p.id === id);
        if (!row) {
          throw new NotFoundException(`Payment ${id} not found`);
        }
        return row;
      }),
      refund: vi.fn(async ({ paymentId: pid }: { paymentId: string }) => {
        const row = paymentStore.find((p) => p.id === pid)!;
        row.status = 'refunded';
        return row;
      }),
    };
    eventBus = { publish: vi.fn().mockResolvedValue(undefined) };

    const returnsRepo = {
      find: vi.fn(async (opts?: { where?: { orderId?: string; status?: string } }) => {
        let rows = [...returnStore];
        if (opts?.where?.orderId) {
          rows = rows.filter((r) => r.orderId === opts.where!.orderId);
        }
        if (opts?.where?.status) {
          rows = rows.filter((r) => r.status === opts.where!.status);
        }
        return rows.map(attachLines);
      }),
      findOne: vi.fn(async (opts: { where: { id: string } }) => {
        const row = returnStore.find((r) => r.id === opts.where.id);
        return row ? attachLines(row) : null;
      }),
    };

    const warehousesRepo = {
      findOne: vi.fn(
        async (opts: { where: { id: string } }) =>
          warehouseStore.find((w) => w.id === opts.where.id) ?? null,
      ),
    };
    const ordersRepo = {
      findOne: vi.fn(async (opts: { where: { id: string } }) => {
        const fromStub = stubOrders.find((o) => o.id === opts.where.id);
        if (fromStub) {
          return fromStub;
        }
        return orderStore.find((o) => o.id === opts.where.id) ?? null;
      }),
    };
    const orderLinesRepo = {
      find: vi.fn(async (opts: { where: { orderId: string } }) =>
        orderLineStore.filter((l) => l.orderId === opts.where.orderId),
      ),
      findOne: vi.fn(
        async (opts: { where: { id: string } }) =>
          orderLineStore.find((l) => l.id === opts.where.id) ?? null,
      ),
    };

    const dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          create: (_Entity: unknown, data: Record<string, unknown>) => ({
            ...data,
          }),
          save: async (entityOrList: unknown) => {
            if (Array.isArray(entityOrList)) {
              return entityOrList.map((item) => {
                const row = item as LineRow & { id?: string };
                if (!row.id) {
                  row.id = crypto.randomUUID();
                }
                if (!row.createdAt) {
                  row.createdAt = now;
                }
                if (!row.updatedAt) {
                  row.updatedAt = now;
                }
                if ('returnId' in row && row.returnId) {
                  const existing = lineStore.findIndex((l) => l.id === row.id);
                  if (existing >= 0) {
                    lineStore[existing] = row as LineRow;
                  } else {
                    lineStore.push(row as LineRow);
                  }
                }
                return row;
              });
            }
            const entity = entityOrList as Record<string, unknown>;
            if (!entity.id) {
              entity.id = crypto.randomUUID();
            }
            if (!entity.createdAt) {
              entity.createdAt = now;
            }
            if (!entity.updatedAt) {
              entity.updatedAt = now;
            }
            if ('resolution' in entity && 'orderId' in entity) {
              const row = entity as unknown as ReturnRow;
              const idx = returnStore.findIndex((r) => r.id === row.id);
              if (idx >= 0) {
                returnStore[idx] = { ...returnStore[idx], ...row };
              } else {
                returnStore.push(row);
              }
              return row;
            }
            if ('currencyCode' in entity && 'subtotalMinor' in entity) {
              const row = entity as unknown as OrderRow;
              stubOrders.push({
                id: row.id,
                status: row.status,
                customerId: row.customerId,
                currencyCode: row.currencyCode,
              });
              return row;
            }
            return entity;
          },
          find: async (Entity: unknown, opts: { where: { returnId?: string } }) => {
            if (Entity === ReturnLineEntity) {
              return lineStore
                .filter((l) => l.returnId === opts.where.returnId)
                .map((l) => Object.assign(new ReturnLineEntity(), l));
            }
            return [];
          },
          findOne: async (Entity: unknown, opts: { where: { id: string } }) => {
            if (Entity === OrderLineEntity) {
              return orderLineStore.find((l) => l.id === opts.where.id) ?? null;
            }
            return null;
          },
          getRepository: () => ({
            createQueryBuilder: () => ({
              setLock: () => ({
                where: (_clause: string, params: { id: string }) => ({
                  getOne: async () => {
                    const row = returnStore.find((r) => r.id === params.id);
                    return row ? Object.assign(new ReturnEntity(), row) : null;
                  },
                }),
              }),
            }),
          }),
        };
        return fn(manager);
      }),
    };

    service = new ReturnsService(
      returnsRepo as never,
      warehousesRepo as never,
      ordersRepo as never,
      orderLinesRepo as never,
      inventory as never,
      payments as never,
      dataSource as never,
      eventBus as never,
    );
  });

  it('create → approve → receive → refund happy path', async () => {
    const created = await service.create({
      orderId,
      warehouseId,
      resolution: 'refund',
      reason: 'defective',
      lines: [{ orderLineId: orderLineA, quantity: 1 }],
    });

    expect(created.status).toBe('requested');
    expect(created.lines).toHaveLength(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.ReturnRequested,
        aggregateType: 'return',
      }),
    );

    const approved = await service.approve(created.id);
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeTruthy();

    const received = await service.receive(created.id);
    expect(received.status).toBe('received');
    expect(inventory.adjust).toHaveBeenCalledWith({
      variantId: variantA,
      warehouseId,
      delta: 1,
      reason: `RMA ${created.id} restock`,
    });

    const refunded = await service.completeRefund({ returnId: created.id });
    expect(refunded.status).toBe('refunded');
    expect(refunded.paymentId).toBe(paymentId);
    expect(refunded.refundAmountMinor).toBe('1000');
    expect(payments.refund).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.RefundCompleted,
      }),
    );
  });

  it('create → approve → receive → exchange creates replacement stub', async () => {
    const created = await service.create({
      orderId,
      warehouseId,
      resolution: 'exchange',
      lines: [{ orderLineId: orderLineA, quantity: 2 }],
    });

    await service.approve(created.id);
    await service.receive(created.id);
    const exchanged = await service.completeExchange(created.id);

    expect(exchanged.status).toBe('exchanged');
    expect(exchanged.replacementOrderId).toBeTruthy();
    expect(stubOrders).toHaveLength(1);
    expect(stubOrders[0]!.status).toBe('pending');
  });

  it('rejects over-return quantity', async () => {
    await expect(
      service.create({
        orderId,
        warehouseId,
        resolution: 'refund',
        lines: [{ orderLineId: orderLineA, quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid status transitions', async () => {
    const created = await service.create({
      orderId,
      warehouseId,
      resolution: 'refund',
      lines: [{ orderLineId: orderLineA, quantity: 1 }],
    });

    await expect(service.receive(created.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancel from requested', async () => {
    const created = await service.create({
      orderId,
      warehouseId,
      resolution: 'refund',
      lines: [{ orderLineId: orderLineA, quantity: 1 }],
    });
    const cancelled = await service.cancel(created.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('findById throws when missing', async () => {
    await expect(service.findById('99999999-9999-9999-9999-999999999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
