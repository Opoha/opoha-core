import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { CustomerGroupsService } from './customer-groups.service';
import {
  AddCustomerToGroupInput,
  CreateCustomerGroupInput,
  CustomerGroupMembershipType,
  CustomerGroupType,
  UpdateCustomerGroupInput,
} from './customer-group.types';

@Resolver(() => CustomerGroupType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CustomerGroupsResolver {
  constructor(private readonly groupsService: CustomerGroupsService) {}

  @Query(() => [CustomerGroupType], {
    name: 'customerGroups',
    description: 'List customer groups',
  })
  @RequirePermission('customer-group:read')
  customerGroups(): Promise<CustomerGroupType[]> {
    return this.groupsService.findAll();
  }

  @Query(() => CustomerGroupType, {
    name: 'customerGroup',
    description: 'Get customer group by id',
  })
  @RequirePermission('customer-group:read')
  customerGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerGroupType> {
    return this.groupsService.findById(id);
  }

  @Query(() => [CustomerGroupMembershipType], {
    name: 'customerGroupMembers',
    description: 'List memberships for a customer group',
  })
  @RequirePermission('customer-group:read')
  customerGroupMembers(
    @Args('groupId', { type: () => ID }) groupId: string,
  ): Promise<CustomerGroupMembershipType[]> {
    return this.groupsService.listMembers(groupId);
  }

  @Query(() => [CustomerGroupMembershipType], {
    name: 'customerMemberships',
    description: 'List group memberships for a customer',
  })
  @RequirePermission('customer:read')
  customerMemberships(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<CustomerGroupMembershipType[]> {
    return this.groupsService.listGroupsForCustomer(customerId);
  }

  @Mutation(() => CustomerGroupType, {
    name: 'createCustomerGroup',
    description: 'Create a customer group',
  })
  @RequirePermission('customer-group:create')
  createCustomerGroup(
    @Args('input', { type: () => CreateCustomerGroupInput })
    input: CreateCustomerGroupInput,
  ): Promise<CustomerGroupType> {
    return this.groupsService.create(input);
  }

  @Mutation(() => CustomerGroupType, {
    name: 'updateCustomerGroup',
    description: 'Update a customer group',
  })
  @RequirePermission('customer-group:update')
  updateCustomerGroup(
    @Args('input', { type: () => UpdateCustomerGroupInput })
    input: UpdateCustomerGroupInput,
  ): Promise<CustomerGroupType> {
    return this.groupsService.update(input);
  }

  @Mutation(() => CustomerGroupMembershipType, {
    name: 'addCustomerToGroup',
    description: 'Add a customer to a group',
  })
  @RequirePermission('customer-group:update')
  addCustomerToGroup(
    @Args('input', { type: () => AddCustomerToGroupInput })
    input: AddCustomerToGroupInput,
  ): Promise<CustomerGroupMembershipType> {
    return this.groupsService.addMember(input);
  }

  @Mutation(() => CustomerGroupMembershipType, {
    name: 'removeCustomerFromGroup',
    description: 'Remove a customer from a group',
  })
  @RequirePermission('customer-group:update')
  removeCustomerFromGroup(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('groupId', { type: () => ID }) groupId: string,
  ): Promise<CustomerGroupMembershipType> {
    return this.groupsService.removeMember(customerId, groupId);
  }
}
