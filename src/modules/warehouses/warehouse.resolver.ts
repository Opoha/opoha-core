import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { WarehouseService } from './warehouse.service';
import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseType,
} from './warehouse.types';

@Resolver(() => WarehouseType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class WarehouseResolver {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Query(() => [WarehouseType], {
    name: 'warehouses',
    description: 'List inventory warehouses / locations',
  })
  @RequirePermission('warehouse:read')
  warehouses(): Promise<WarehouseType[]> {
    return this.warehouseService.findAll();
  }

  @Query(() => WarehouseType, {
    name: 'warehouse',
    description: 'Get warehouse by id',
  })
  @RequirePermission('warehouse:read')
  warehouse(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WarehouseType> {
    return this.warehouseService.findById(id);
  }

  @Query(() => WarehouseType, {
    name: 'warehouseByCode',
    description: 'Get warehouse by stable code',
  })
  @RequirePermission('warehouse:read')
  warehouseByCode(
    @Args('code', { type: () => String }) code: string,
  ): Promise<WarehouseType> {
    return this.warehouseService.findByCode(code);
  }

  @Query(() => WarehouseType, {
    name: 'defaultWarehouse',
    description: 'Get the default warehouse when configured',
    nullable: true,
  })
  @RequirePermission('warehouse:read')
  defaultWarehouse(): Promise<WarehouseType | null> {
    return this.warehouseService.findDefault();
  }

  @Mutation(() => WarehouseType, {
    name: 'createWarehouse',
    description: 'Create an inventory warehouse / location',
  })
  @RequirePermission('warehouse:create')
  createWarehouse(
    @Args('input', { type: () => CreateWarehouseInput })
    input: CreateWarehouseInput,
  ): Promise<WarehouseType> {
    return this.warehouseService.create(input);
  }

  @Mutation(() => WarehouseType, {
    name: 'updateWarehouse',
    description: 'Update a warehouse / location',
  })
  @RequirePermission('warehouse:update')
  updateWarehouse(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateWarehouseInput })
    input: UpdateWarehouseInput,
  ): Promise<WarehouseType> {
    return this.warehouseService.update(id, input);
  }

  @Mutation(() => WarehouseType, {
    name: 'deleteWarehouse',
    description: 'Delete a non-default warehouse',
  })
  @RequirePermission('warehouse:delete')
  deleteWarehouse(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WarehouseType> {
    return this.warehouseService.remove(id);
  }
}
