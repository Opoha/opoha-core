/**
 * Public inventory module surface.
 */
export { InventoryModule } from '../inventory.module';
export { InventoryService } from '../inventory.service';
export { StockTransferService } from '../stock-transfer.service';
export {
  InventoryAdjustmentEntity,
  InventoryItemEntity,
  InventoryReservationEntity,
  StockTransferEntity,
  StockTransferLineEntity,
  inventoryEntities,
} from '../entities';
export type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryAdjustmentType,
  InventoryItemType,
  InventoryReservationType,
  ReserveInventoryInput,
} from '../inventory.types';
export type {
  CreateStockTransferInput,
  StockTransferLineType,
  StockTransferType,
} from '../stock-transfer.types';
