import { InventoryAdjustmentEntity } from './inventory-adjustment.entity';
import { InventoryItemEntity } from './inventory-item.entity';
import { InventoryReservationEntity } from './inventory-reservation.entity';
import { StockTransferLineEntity } from './stock-transfer-line.entity';
import { StockTransferEntity } from './stock-transfer.entity';

export const inventoryEntities = [
  InventoryItemEntity,
  InventoryReservationEntity,
  InventoryAdjustmentEntity,
  StockTransferEntity,
  StockTransferLineEntity,
] as const;

export {
  InventoryAdjustmentEntity,
  InventoryItemEntity,
  InventoryReservationEntity,
  StockTransferEntity,
  StockTransferLineEntity,
};
export type { InventoryReservationStatus } from './inventory-reservation.entity';
export type { StockTransferStatus } from './stock-transfer.entity';
