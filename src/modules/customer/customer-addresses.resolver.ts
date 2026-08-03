import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { CustomerAddressesService } from './customer-addresses.service';
import {
  CreateCustomerAddressInput,
  CustomerAddressType,
  UpdateCustomerAddressInput,
} from './customer-address.types';

@Resolver(() => CustomerAddressType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CustomerAddressesResolver {
  constructor(private readonly addressesService: CustomerAddressesService) {}

  @Query(() => [CustomerAddressType], {
    name: 'customerAddresses',
    description: 'List addresses for a customer (staff)',
  })
  @RequirePermission('customer:read')
  customerAddresses(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<CustomerAddressType[]> {
    return this.addressesService.listByCustomer(customerId);
  }

  @Query(() => CustomerAddressType, {
    name: 'customerAddress',
    description: 'Get customer address by id (staff)',
  })
  @RequirePermission('customer:read')
  customerAddress(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerAddressType> {
    return this.addressesService.findById(id);
  }

  @Mutation(() => CustomerAddressType, {
    name: 'createCustomerAddress',
    description: 'Create a customer address (staff)',
  })
  @RequirePermission('customer:update')
  createCustomerAddress(
    @Args('input', { type: () => CreateCustomerAddressInput })
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddressType> {
    return this.addressesService.create(input);
  }

  @Mutation(() => CustomerAddressType, {
    name: 'updateCustomerAddress',
    description: 'Update a customer address (staff)',
  })
  @RequirePermission('customer:update')
  updateCustomerAddress(
    @Args('input', { type: () => UpdateCustomerAddressInput })
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddressType> {
    return this.addressesService.update(input);
  }

  @Mutation(() => CustomerAddressType, {
    name: 'deleteCustomerAddress',
    description: 'Delete a customer address (staff)',
  })
  @RequirePermission('customer:update')
  deleteCustomerAddress(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerAddressType> {
    return this.addressesService.remove(id);
  }
}
