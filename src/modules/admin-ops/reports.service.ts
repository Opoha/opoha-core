import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FulfillmentEntity } from '../fulfillment/public';
import { InventoryItemEntity } from '../inventory/public';
import { OrderEntity } from '../order/public';
import { WarehouseEntity } from '../warehouses/public';
import type {
  FulfillmentThroughputType,
  InventoryByWarehouseRow,
  OrdersReportType,
} from './admin-ops.types';

export type ReportWindowInput = {
  from?: Date | null;
  to?: Date | null;
};

function assertWindow(from?: Date | null, to?: Date | null): void {
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException('from must be <= to');
  }
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(InventoryItemEntity)
    private readonly inventoryItems: Repository<InventoryItemEntity>,
    @InjectRepository(FulfillmentEntity)
    private readonly fulfillments: Repository<FulfillmentEntity>,
  ) {}

  /**
   * Aggregate order counts and revenue (total_minor) optionally filtered by created_at.
   */
  async ordersReport(input: ReportWindowInput = {}): Promise<OrdersReportType> {
    assertWindow(input.from, input.to);

    const qb = this.orders
.createQueryBuilder('o')
.select('o.status', 'status')
.addSelect('COUNT(*)', 'orderCount')
.addSelect('COALESCE(SUM(CAST(o.totalMinor AS bigint)), 0)', 'totalMinorSum')
.groupBy('o.status');

    if (input.from) {
      qb.andWhere('o.createdAt >= :from', { from: input.from });
    }
    if (input.to) {
      qb.andWhere('o.createdAt <= :to', { to: input.to });
    }

    const rows = await qb.getRawMany<{
      status: string;
      orderCount: string;
      totalMinorSum: string;
    }>();

    const byStatus = rows.map((row) => ({
      status: row.status,
      orderCount: Number(row.orderCount),
      totalMinorSum: String(row.totalMinorSum),
    }));

    const orderCount = byStatus.reduce((sum, row) => sum + row.orderCount, 0);
    const totalMinorSum = byStatus
.reduce((sum, row) => sum + BigInt(row.totalMinorSum), 0n)
.toString();

    return {
      orderCount,
      totalMinorSum,
      byStatus,
      from: input.from ?? null,
      to: input.to ?? null,
    };
  }

  /**
   * Stock levels rolled up by warehouse (optionally a single warehouse).
   */
  async inventoryByWarehouse(warehouseId?: string | null): Promise<InventoryByWarehouseRow[]> {
    const qb = this.inventoryItems
.createQueryBuilder('i')
.innerJoin(WarehouseEntity, 'w', 'w.id = i.warehouseId')
.select('i.warehouseId', 'warehouseId')
.addSelect('w.code', 'warehouseCode')
.addSelect('w.name', 'warehouseName')
.addSelect('COUNT(*)', 'skuCount')
.addSelect('COALESCE(SUM(i.quantityOnHand), 0)', 'quantityOnHand')
.addSelect('COALESCE(SUM(i.quantityReserved), 0)', 'quantityReserved')
.groupBy('i.warehouseId')
.addGroupBy('w.code')
.addGroupBy('w.name')
.orderBy('w.code', 'ASC');

    if (warehouseId) {
      qb.andWhere('i.warehouseId = :warehouseId', { warehouseId });
    }

    const rows = await qb.getRawMany<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      skuCount: string;
      quantityOnHand: string;
      quantityReserved: string;
    }>();

    return rows.map((row) => {
      const onHand = Number(row.quantityOnHand);
      const reserved = Number(row.quantityReserved);
      return {
        warehouseId: row.warehouseId,
        warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName,
        skuCount: Number(row.skuCount),
        quantityOnHand: onHand,
        quantityReserved: reserved,
        quantityAvailable: onHand - reserved,
      };
    });
  }

  /**
   * Fulfillment created/shipped counts and status breakdown for a window.
   */
  async fulfillmentThroughput(input: ReportWindowInput = {}): Promise<FulfillmentThroughputType> {
    assertWindow(input.from, input.to);

    const statusQb = this.fulfillments
.createQueryBuilder('f')
.select('f.status', 'status')
.addSelect('COUNT(*)', 'count')
.groupBy('f.status');

    if (input.from) {
      statusQb.andWhere('f.createdAt >= :from', { from: input.from });
    }
    if (input.to) {
      statusQb.andWhere('f.createdAt <= :to', { to: input.to });
    }

    const statusRows = await statusQb.getRawMany<{
      status: string;
      count: string;
    }>();

    const byStatus = statusRows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));

    const createdCount = byStatus.reduce((sum, row) => sum + row.count, 0);

    const shippedQb = this.fulfillments
.createQueryBuilder('f')
.where("f.status = 'shipped'")
.andWhere('f.shippedAt IS NOT NULL');

    if (input.from) {
      shippedQb.andWhere('f.shippedAt >= :from', { from: input.from });
    }
    if (input.to) {
      shippedQb.andWhere('f.shippedAt <= :to', { to: input.to });
    }

    const shippedCount = await shippedQb.getCount();

    return {
      createdCount,
      shippedCount,
      byStatus,
      from: input.from ?? null,
      to: input.to ?? null,
    };
  }
}
