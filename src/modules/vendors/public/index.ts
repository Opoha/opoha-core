/**
 * Public marketplace vendors module surface.
 */
export { VendorsModule } from '../vendors.module';
export { VendorService } from '../vendor.service';
export { VendorEntity, vendorEntities } from '../entities';
export {
  VendorType,
  CreateVendorInput,
  UpdateVendorInput,
  AssignProductVendorInput,
} from '../vendor.types';
export { ProductVendorAssignmentType } from '../vendor.resolver';
export type {
  VendorUpdatedData,
  VendorUpdatedEvent,
  VendorOrderRoutedData,
  VendorOrderRoutedEvent,
} from '../events/vendor-events';
