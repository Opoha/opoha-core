import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../../auth/public';
import {
  AttachProductMediaInput,
  ProductMediaType,
  UpdateProductMediaInput,
} from './product-media.types';
import { ProductMediaService } from './product-media.service';

@Resolver(() => ProductMediaType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ProductMediaResolver {
  constructor(private readonly productMediaService: ProductMediaService) {}

  @Query(() => [ProductMediaType], {
    name: 'productMedia',
    description: 'List media links for a product',
  })
  @RequirePermission('product-media:read')
  productMedia(
    @Args('productId', { type: () => ID }) productId: string,
  ): Promise<ProductMediaType[]> {
    return this.productMediaService.listByProduct(productId);
  }

  @Query(() => ProductMediaType, {
    name: 'productMediaItem',
    description: 'Get a product media link by id',
  })
  @RequirePermission('product-media:read')
  productMediaItem(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProductMediaType> {
    return this.productMediaService.findById(id);
  }

  @Mutation(() => ProductMediaType, {
    name: 'attachProductMedia',
    description: 'Link a files abstraction fileId to a product',
  })
  @RequirePermission('product-media:create')
  attachProductMedia(
    @Args('input', { type: () => AttachProductMediaInput })
    input: AttachProductMediaInput,
  ): Promise<ProductMediaType> {
    return this.productMediaService.attach(input);
  }

  @Mutation(() => ProductMediaType, {
    name: 'updateProductMedia',
    description: 'Update product media sort order or alt text',
  })
  @RequirePermission('product-media:update')
  updateProductMedia(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateProductMediaInput })
    input: UpdateProductMediaInput,
  ): Promise<ProductMediaType> {
    return this.productMediaService.update(id, input);
  }

  @Mutation(() => ProductMediaType, {
    name: 'detachProductMedia',
    description: 'Remove a product↔file media link (does not delete the file)',
  })
  @RequirePermission('product-media:delete')
  detachProductMedia(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ProductMediaType> {
    return this.productMediaService.detach(id);
  }
}
