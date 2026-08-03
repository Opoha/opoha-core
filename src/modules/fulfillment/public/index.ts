/**
 * Public fulfillment module surface (pick → pack → ship).
 */
export { FulfillmentModule } from '../fulfillment.module';
export { FulfillmentService } from '../fulfillment.service';
export {
  FulfillmentEntity,
  FulfillmentLineEntity,
  FulfillmentPackageEntity,
  fulfillmentEntities,
} from '../entities';
export type { FulfillmentStatus } from '../entities';
export { FulfillmentResolver } from '../fulfillment.resolver';
export {
  CreateFulfillmentInput,
  FulfillmentLineInput,
  FulfillmentLineType,
  FulfillmentPackageInput,
  FulfillmentPackageType,
  FulfillmentType,
  PackFulfillmentInput,
  ShipFulfillmentInput,
} from '../fulfillment.types';
