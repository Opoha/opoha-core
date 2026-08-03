import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { SupplierService } from './supplier.service';
import {
  CreateSupplierInput,
  SupplierType,
  UpdateSupplierInput,
} from './supplier.types';

@Resolver(() => SupplierType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class SupplierResolver {
  constructor(private readonly supplierService: SupplierService) {}

  @Query(() => [SupplierType], {
    name: 'suppliers',
    description: 'List suppliers / vendors',
  })
  @RequirePermission('supplier:read')
  suppliers(): Promise<SupplierType[]> {
    return this.supplierService.findAll();
  }

  @Query(() => SupplierType, {
    name: 'supplier',
    description: 'Get supplier by id',
  })
  @RequirePermission('supplier:read')
  supplier(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SupplierType> {
    return this.supplierService.findById(id);
  }

  @Query(() => SupplierType, {
    name: 'supplierByCode',
    description: 'Get supplier by stable code',
  })
  @RequirePermission('supplier:read')
  supplierByCode(
    @Args('code', { type: () => String }) code: string,
  ): Promise<SupplierType> {
    return this.supplierService.findByCode(code);
  }

  @Mutation(() => SupplierType, {
    name: 'createSupplier',
    description: 'Create a supplier / vendor',
  })
  @RequirePermission('supplier:create')
  createSupplier(
    @Args('input', { type: () => CreateSupplierInput })
    input: CreateSupplierInput,
  ): Promise<SupplierType> {
    return this.supplierService.create(input);
  }

  @Mutation(() => SupplierType, {
    name: 'updateSupplier',
    description: 'Update a supplier / vendor',
  })
  @RequirePermission('supplier:update')
  updateSupplier(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateSupplierInput })
    input: UpdateSupplierInput,
  ): Promise<SupplierType> {
    return this.supplierService.update(id, input);
  }

  @Mutation(() => SupplierType, {
    name: 'deleteSupplier',
    description: 'Delete a supplier / vendor',
  })
  @RequirePermission('supplier:delete')
  deleteSupplier(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SupplierType> {
    return this.supplierService.remove(id);
  }
}
