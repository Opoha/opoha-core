import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { CustomersService } from './customers.service';
import {
  CreateCustomerInput,
  CustomerType,
  RegisterCustomerInput,
  UpdateCustomerInput,
} from './customer.types';

@Resolver(() => CustomerType)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  /** Public storefront registration — separate customer identity (not staff JWT). */
  @Mutation(() => CustomerType, {
    name: 'registerCustomer',
    description: 'Register a new storefront customer account',
  })
  registerCustomer(
    @Args('input', { type: () => RegisterCustomerInput })
    input: RegisterCustomerInput,
  ): Promise<CustomerType> {
    return this.customersService.register(input);
  }

  @Query(() => [CustomerType], {
    name: 'customers',
    description: 'List customers (staff)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('customer:read')
  customers(): Promise<CustomerType[]> {
    return this.customersService.findAll();
  }

  @Query(() => CustomerType, {
    name: 'customer',
    description: 'Get customer by id (staff)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('customer:read')
  customer(@Args('id', { type: () => ID }) id: string): Promise<CustomerType> {
    return this.customersService.findById(id);
  }

  @Mutation(() => CustomerType, {
    name: 'createCustomer',
    description: 'Create a customer account (staff)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('customer:create')
  createCustomer(
    @Args('input', { type: () => CreateCustomerInput })
    input: CreateCustomerInput,
  ): Promise<CustomerType> {
    return this.customersService.create(input);
  }

  @Mutation(() => CustomerType, {
    name: 'updateCustomer',
    description: 'Update customer profile (staff)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('customer:update')
  updateCustomer(
    @Args('input', { type: () => UpdateCustomerInput })
    input: UpdateCustomerInput,
  ): Promise<CustomerType> {
    return this.customersService.update(input);
  }
}
