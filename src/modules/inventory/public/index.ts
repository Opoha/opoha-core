/**
 * Public inventory module surface.
 */
export { InventoryModule } from '../inventory.module';
export { InventoryService } from '../inventory.service';
export {
  InventoryAdjustmentEntity,
  InventoryItemEntity,
  InventoryReservationEntity,
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
