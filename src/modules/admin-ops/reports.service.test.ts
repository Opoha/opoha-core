import { describe, expect, it, vi } from 'vitest';

import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('aggregates orders report from grouped raw rows', async () => {
    const orders = {
      createQueryBuilder: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { status: 'pending', orderCount: '2', totalMinorSum: '100' },
          { status: 'fulfilled', orderCount: '1', totalMinorSum: '50' },
        ]),
      }),
    };
    const service = new ReportsService(
      orders as never,
      {} as never,
      {} as never,
    );

    const report = await service.ordersReport({});
    expect(report.orderCount).toBe(3);
    expect(report.totalMinorSum).toBe('150');
    expect(report.byStatus).toHaveLength(2);
  });

  it('rejects inverted report windows', async () => {
    const service = new ReportsService(
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.ordersReport({
        from: new Date('2026-08-02T00:00:00.000Z'),
        to: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(/from must be <= to/);
  });

  it('rolls up inventory by warehouse', async () => {
    const inventoryItems = {
      createQueryBuilder: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          {
            warehouseId: 'wh-1',
            warehouseCode: 'MAIN',
            warehouseName: 'Main',
            skuCount: '3',
            quantityOnHand: '10',
            quantityReserved: '2',
          },
        ]),
      }),
    };
    const service = new ReportsService(
      {} as never,
      inventoryItems as never,
      {} as never,
    );

    const rows = await service.inventoryByWarehouse();
    expect(rows).toEqual([
      {
        warehouseId: 'wh-1',
        warehouseCode: 'MAIN',
        warehouseName: 'Main',
        skuCount: 3,
        quantityOnHand: 10,
        quantityReserved: 2,
        quantityAvailable: 8,
      },
    ]);
  });

  it('computes fulfillment throughput created vs shipped', async () => {
    const statusQb = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { status: 'pending', count: '1' },
        { status: 'shipped', count: '2' },
      ]),
    };
    const shippedQb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(2),
    };
    const fulfillments = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(statusQb)
        .mockReturnValueOnce(shippedQb),
    };
    const service = new ReportsService(
      {} as never,
      {} as never,
      fulfillments as never,
    );

    const report = await service.fulfillmentThroughput({});
    expect(report.createdCount).toBe(3);
    expect(report.shippedCount).toBe(2);
    expect(report.byStatus).toHaveLength(2);
  });
});
