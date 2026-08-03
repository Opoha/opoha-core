import { UseGuards } from '@nestjs/common';
import { Args, GraphQLISODateTime, ID, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import {
  FulfillmentThroughputType,
  InventoryByWarehouseRow,
  OrdersReportType,
} from './admin-ops.types';
import { ReportsService } from './reports.service';

@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ReportsResolver {
  constructor(private readonly reports: ReportsService) {}

  @Query(() => OrdersReportType, {
    name: 'ordersReport',
    description:
      'Aggregated order counts and revenue (total_minor) by status; optional created_at window',
  })
  @RequirePermission('report:read')
  ordersReport(
    @Args('from', { type: () => GraphQLISODateTime, nullable: true })
    from?: Date,
    @Args('to', { type: () => GraphQLISODateTime, nullable: true }) to?: Date,
  ): Promise<OrdersReportType> {
    return this.reports.ordersReport({ from, to });
  }

  @Query(() => [InventoryByWarehouseRow], {
    name: 'inventoryByWarehouseReport',
    description: 'Inventory on-hand / reserved totals rolled up by warehouse',
  })
  @RequirePermission('report:read')
  inventoryByWarehouseReport(
    @Args('warehouseId', { type: () => ID, nullable: true })
    warehouseId?: string,
  ): Promise<InventoryByWarehouseRow[]> {
    return this.reports.inventoryByWarehouse(warehouseId);
  }

  @Query(() => FulfillmentThroughputType, {
    name: 'fulfillmentThroughputReport',
    description:
      'Fulfillment created vs shipped counts and status breakdown for a window',
  })
  @RequirePermission('report:read')
  fulfillmentThroughputReport(
    @Args('from', { type: () => GraphQLISODateTime, nullable: true })
    from?: Date,
    @Args('to', { type: () => GraphQLISODateTime, nullable: true }) to?: Date,
  ): Promise<FulfillmentThroughputType> {
    return this.reports.fulfillmentThroughput({ from, to });
  }
}
