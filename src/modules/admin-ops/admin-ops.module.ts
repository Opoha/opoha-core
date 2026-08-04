import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CatalogModule } from '../catalog/public';
import { EventBusModule } from '../event-bus/public';
import { FulfillmentEntity } from '../fulfillment/public';
import { InventoryItemEntity, InventoryModule } from '../inventory/public';
import { OrderEntity } from '../order/public';
import { ActivityAuditListener } from './activity-audit.listener';
import { BulkOpsResolver } from './bulk-ops.resolver';
import { BulkOpsService } from './bulk-ops.service';
import { ReportsResolver } from './reports.resolver';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AuthModule,
    EventBusModule,
    CatalogModule,
    InventoryModule,
    TypeOrmModule.forFeature([OrderEntity, InventoryItemEntity, FulfillmentEntity]),
  ],
  providers: [
    ReportsService,
    ReportsResolver,
    BulkOpsService,
    BulkOpsResolver,
    ActivityAuditListener,
  ],
  exports: [ReportsService, BulkOpsService],
})
export class AdminOpsModule {}
