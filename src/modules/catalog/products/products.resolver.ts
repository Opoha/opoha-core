import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../../auth/public';
import { StoreCatalogModeGql } from '../../config/public';
import type { StoreCatalogMode } from '../../config/public';
import { ContributionRegistry } from '../../plugin-loader/public';
import { resolveLocalePreference } from '../translations/locale';
import {
  CreateProductInput,
  ProductReviewAggregateType,
  ProductType,
  UpdateProductInput,
} from './product.types';
import { ProductsService } from './products.service';

/**
 * Documented contract for the optional `product-review.reviews` provider
 * (see `@opoha/plugin-product-review`). Core never imports the plugin —
 * this shape is a duck-typed agreement resolved by string token only
 *.
 */
export type ReviewAggregateProvider = {
  aggregate(productId: string):
    | {
        averageRating: number;
        reviewCount: number;
      }
    | null
    | undefined;
};

export const REVIEW_AGGREGATE_PROVIDER_TOKEN = 'product-review.reviews';

type GqlRequestContext = {
  req?: { headers?: Record<string, string | string[] | undefined> };
};

@Resolver(() => ProductType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly contributions: ContributionRegistry,
  ) {}

  /**
 * Review-aggregate hook — looks up the generic
   * `product-review.reviews` provider token via ContributionRegistry.
   * Returns null when no (active) review plugin is installed.
   */
  @ResolveField(() => ProductReviewAggregateType, { nullable: true })
  reviewAggregate(@Parent() product: ProductType): ProductReviewAggregateType | null {
    const provider = this.contributions.getProvider<ReviewAggregateProvider>(
      REVIEW_AGGREGATE_PROVIDER_TOKEN,
    );
    const aggregate = provider?.aggregate(product.id);
    if (aggregate == null) {
      return null;
    }
    // Project duck-typed plugin payload onto the core GraphQL type only.
    return {
      averageRating: aggregate.averageRating,
      reviewCount: aggregate.reviewCount,
    };
  }

  @Query(() => [ProductType], {
    name: 'products',
    description:
      'List catalog products. Optional storeId scopes the list; optional catalogMode overrides channel settings (shared = shared∪owned, isolated = owned-only). Optional locale (or Accept-Language) overlays translations.',
  })
  @RequirePermission('product:read')
  products(
    @Args('storeId', { type: () => ID, nullable: true }) storeId?: string,
    @Args('catalogMode', {
      type: () => StoreCatalogModeGql,
      nullable: true,
    })
    catalogMode?: StoreCatalogMode,
    @Args('locale', {
      type: () => String,
      nullable: true,
      description: 'BCP 47 locale; falls back to Accept-Language when omitted',
    })
    locale?: string,
    @Context() ctx?: GqlRequestContext,
  ): Promise<ProductType[]> {
    const resolved = resolveLocalePreference({
      localeArg: locale,
      headers: ctx?.req?.headers,
    });
    return this.productsService.findAll(storeId, catalogMode, resolved);
  }

  @Query(() => ProductType, {
    name: 'product',
    description:
      'Get catalog product by id. Optional locale (or Accept-Language) overlays translations.',
  })
  @RequirePermission('product:read')
  product(
    @Args('id', { type: () => ID }) id: string,
    @Args('locale', {
      type: () => String,
      nullable: true,
      description: 'BCP 47 locale; falls back to Accept-Language when omitted',
    })
    locale?: string,
    @Context() ctx?: GqlRequestContext,
  ): Promise<ProductType> {
    const resolved = resolveLocalePreference({
      localeArg: locale,
      headers: ctx?.req?.headers,
    });
    return this.productsService.findById(id, resolved);
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
  deleteProduct(@Args('id', { type: () => ID }) id: string): Promise<ProductType> {
    return this.productsService.remove(id);
  }
}
