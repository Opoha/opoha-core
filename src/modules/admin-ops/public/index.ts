/**
 * Public admin-ops surface (reports, bulk mutations, activity audit bridge).
 */
export { AdminOpsModule } from '../admin-ops.module';
export { ReportsService } from '../reports.service';
export { BulkOpsService } from '../bulk-ops.service';
export {
  OrdersReportType,
  InventoryByWarehouseRow,
  FulfillmentThroughputType,
  BulkUpdateProductsResult,
  BulkAdjustInventoryResult,
} from '../admin-ops.types';
