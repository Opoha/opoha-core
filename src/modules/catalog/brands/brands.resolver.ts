import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../../auth/public';
import { BrandType, CreateBrandInput, UpdateBrandInput } from './brand.types';
import { BrandsService } from './brands.service';

@Resolver(() => BrandType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class BrandsResolver {
  constructor(private readonly brandsService: BrandsService) {}

  @Query(() => [BrandType], {
    name: 'brands',
    description: 'List catalog brands',
  })
  @RequirePermission('brand:read')
  brands(): Promise<BrandType[]> {
    return this.brandsService.findAll();
  }

  @Query(() => BrandType, {
    name: 'brand',
    description: 'Get catalog brand by id',
  })
  @RequirePermission('brand:read')
  brand(@Args('id', { type: () => ID }) id: string): Promise<BrandType> {
    return this.brandsService.findById(id);
  }

  @Mutation(() => BrandType, {
    name: 'createBrand',
    description: 'Create a catalog brand',
  })
  @RequirePermission('brand:create')
  createBrand(
    @Args('input', { type: () => CreateBrandInput }) input: CreateBrandInput,
  ): Promise<BrandType> {
    return this.brandsService.create(input);
  }

  @Mutation(() => BrandType, {
    name: 'updateBrand',
    description: 'Update a catalog brand',
  })
  @RequirePermission('brand:update')
  updateBrand(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateBrandInput }) input: UpdateBrandInput,
  ): Promise<BrandType> {
    return this.brandsService.update(id, input);
  }

  @Mutation(() => BrandType, {
    name: 'deleteBrand',
    description: 'Delete a catalog brand',
  })
  @RequirePermission('brand:delete')
  deleteBrand(@Args('id', { type: () => ID }) id: string): Promise<BrandType> {
    return this.brandsService.remove(id);
  }
}
