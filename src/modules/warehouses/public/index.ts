/**
 * Public warehouses module surface.
 */
export { WarehousesModule } from '../warehouses.module';
export { WarehouseService } from '../warehouse.service';
export { StoreWarehouseService } from '../store-warehouse.service';
export {
  WarehouseEntity,
  StoreWarehouseEntity,
  warehouseEntities,
} from '../entities';
export type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseType,
} from '../warehouse.types';
export type {
  LinkStoreWarehouseInput,
  StoreWarehouseType,
} from '../store-warehouse.types';
export type {
  StoreWarehouseUpdatedData,
  StoreWarehouseUpdatedEvent,
} from '../events/warehouse-events';
