import { InventoryAdjustmentEntity } from './inventory-adjustment.entity';
import { InventoryItemEntity } from './inventory-item.entity';
import { InventoryReservationEntity } from './inventory-reservation.entity';

export const inventoryEntities = [
  InventoryItemEntity,
  InventoryReservationEntity,
  InventoryAdjustmentEntity,
] as const;

export {
  InventoryAdjustmentEntity,
  InventoryItemEntity,
  InventoryReservationEntity,
};
export type { InventoryReservationStatus } from './inventory-reservation.entity';
