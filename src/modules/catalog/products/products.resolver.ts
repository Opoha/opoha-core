import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../../auth/public';
import {
  CreateProductInput,
  ProductType,
  UpdateProductInput,
} from './product.types';
import { ProductsService } from './products.service';

@Resolver(() => ProductType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Query(() => [ProductType], {
    name: 'products',
    description: 'List catalog products',
  })
  @RequirePermission('product:read')
  products(): Promise<ProductType[]> {
    return this.productsService.findAll();
  }

  @Query(() => ProductType, {
    name: 'product',
    description: 'Get catalog product by id',
  })
  @RequirePermission('product:read')
  product(@Args('id', { type: () => ID }) id: string): Promise<ProductType> {
    return this.productsService.findById(id);
  }

  @Mutation(() => ProductType, {
    name: 'createProduct',
    description: 'Create a catalog product (optional initial variants)',
  })
  @RequirePermission('product:create')
  createProduct(
    @Args('input', { type: () => CreateProductInput }) input: CreateProductInput,
  ): Promise<ProductType> {
    return this.productsService.create(input);
  }

  @Mutation(() => ProductType, {
    name: 'updateProduct',
    description: 'Update a catalog product',
  })
  @RequirePermission('product:update')
  updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateProductInput }) input: UpdateProductInput,
  ): Promise<ProductType> {
    return this.productsService.update(id, input);
  }

  @Mutation(() => ProductType, {
    name: 'deleteProduct',
    description: 'Delete a catalog product and its variants',
  })
  @RequirePermission('product:delete')
  deleteProduct(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProductType> {
    return this.productsService.remove(id);
  }
}
