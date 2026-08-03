/**
 * Public customer module surface.
 */
export { CustomerModule } from '../customer.module';
export { CustomersService } from '../customers.service';
export { CustomerGroupsService } from '../customer-groups.service';
export {
  CustomerAddressEntity,
  CustomerEntity,
  CustomerGroupEntity,
  CustomerGroupMembershipEntity,
  customerEntities,
} from '../entities';
export type {
  CreateCustomerInput,
  CustomerType,
  RegisterCustomerInput,
  UpdateCustomerInput,
} from '../customer.types';
export type {
  AddCustomerToGroupInput,
  CreateCustomerGroupInput,
  CustomerGroupMembershipType,
  CustomerGroupType,
  UpdateCustomerGroupInput,
} from '../customer-group.types';
