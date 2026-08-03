import { FulfillmentLineEntity } from './fulfillment-line.entity';
import { FulfillmentPackageEntity } from './fulfillment-package.entity';
import { FulfillmentEntity } from './fulfillment.entity';

export const fulfillmentEntities = [
  FulfillmentEntity,
  FulfillmentLineEntity,
  FulfillmentPackageEntity,
] as const;

export {
  FulfillmentEntity,
  FulfillmentLineEntity,
  FulfillmentPackageEntity,
};
export type { FulfillmentStatus } from './fulfillment.entity';
