import { StoreWarehouseEntity } from './store-warehouse.entity';
import { WarehouseEntity } from './warehouse.entity';

export const warehouseEntities = [
  WarehouseEntity,
  StoreWarehouseEntity,
] as const;

export { WarehouseEntity, StoreWarehouseEntity };
