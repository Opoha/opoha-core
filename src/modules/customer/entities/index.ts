import { CustomerAddressEntity } from './customer-address.entity';
import { CustomerGroupMembershipEntity } from './customer-group-membership.entity';
import { CustomerGroupEntity } from './customer-group.entity';
import { CustomerEntity } from './customer.entity';

export const customerEntities = [
  CustomerEntity,
  CustomerAddressEntity,
  CustomerGroupEntity,
  CustomerGroupMembershipEntity,
] as const;

export {
  CustomerAddressEntity,
  CustomerEntity,
  CustomerGroupEntity,
  CustomerGroupMembershipEntity,
};
