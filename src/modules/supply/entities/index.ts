import { PurchaseOrderLineEntity } from './purchase-order-line.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { SupplierEntity } from './supplier.entity';

export const supplyEntities = [
  SupplierEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
] as const;

export {
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  SupplierEntity,
};
export type { PurchaseOrderStatus } from './purchase-order.entity';
