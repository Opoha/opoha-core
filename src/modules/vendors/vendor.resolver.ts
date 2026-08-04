import { UseGuards } from '@nestjs/common';
import { Args, Field, ID, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { VendorService } from './vendor.service';
import {
  AssignProductVendorInput,
  CreateVendorInput,
  UpdateVendorInput,
  VendorType,
} from './vendor.types';

@ObjectType({ description: 'Product ↔ marketplace vendor association' })
export class ProductVendorAssignmentType {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID, { nullable: true })
  vendorId!: string | null;
}

@Resolver(() => VendorType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class VendorResolver {
  constructor(private readonly vendorService: VendorService) {}

  @Query(() => [VendorType], {
    name: 'marketplaceVendors',
    description: 'List marketplace seller accounts',
  })
  @RequirePermission('vendor:read')
  marketplaceVendors(
    @Args('storeId', { type: () => ID, nullable: true }) storeId?: string | null,
  ): Promise<VendorType[]> {
    return this.vendorService.findAll(storeId);
  }

  @Query(() => VendorType, {
    name: 'marketplaceVendor',
    description: 'Get marketplace vendor by id',
  })
  @RequirePermission('vendor:read')
  marketplaceVendor(@Args('id', { type: () => ID }) id: string): Promise<VendorType> {
    return this.vendorService.findById(id);
  }

  @Query(() => VendorType, {
    name: 'marketplaceVendorByCode',
    description: 'Get marketplace vendor by stable code',
  })
  @RequirePermission('vendor:read')
  marketplaceVendorByCode(@Args('code', { type: () => String }) code: string): Promise<VendorType> {
    return this.vendorService.findByCode(code);
  }

  @Mutation(() => VendorType, {
    name: 'createMarketplaceVendor',
    description: 'Create a marketplace seller account',
  })
  @RequirePermission('vendor:create')
  createMarketplaceVendor(
    @Args('input', { type: () => CreateVendorInput })
    input: CreateVendorInput,
  ): Promise<VendorType> {
    return this.vendorService.create(input);
  }

  @Mutation(() => VendorType, {
    name: 'updateMarketplaceVendor',
    description: 'Update a marketplace seller account',
  })
  @RequirePermission('vendor:update')
  updateMarketplaceVendor(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateVendorInput })
    input: UpdateVendorInput,
  ): Promise<VendorType> {
    return this.vendorService.update(id, input);
  }

  @Mutation(() => VendorType, {
    name: 'deleteMarketplaceVendor',
    description: 'Delete a marketplace seller account',
  })
  @RequirePermission('vendor:delete')
  deleteMarketplaceVendor(@Args('id', { type: () => ID }) id: string): Promise<VendorType> {
    return this.vendorService.remove(id);
  }

  @Mutation(() => ProductVendorAssignmentType, {
    name: 'assignProductVendor',
    description: 'Associate a catalog product with a marketplace vendor',
  })
  @RequirePermission('vendor:update')
  assignProductVendor(
    @Args('input', { type: () => AssignProductVendorInput })
    input: AssignProductVendorInput,
  ): Promise<ProductVendorAssignmentType> {
    return this.vendorService.assignProductVendor(input);
  }
}
