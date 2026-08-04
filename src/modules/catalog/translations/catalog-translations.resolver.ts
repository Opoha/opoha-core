import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../../auth/public';
import {
  CategoryTranslationType,
  ProductTranslationType,
  UpsertCategoryTranslationInput,
  UpsertProductTranslationInput,
} from './catalog-translation.types';
import { CatalogTranslationsService } from './catalog-translations.service';

/**
 * Catalog translation write/list GraphQL (Phase 5 C-03).
 * Read overlays remain on product/category queries via `locale` / Accept-Language.
 */
@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CatalogTranslationsResolver {
  constructor(private readonly translations: CatalogTranslationsService) {}

  @Query(() => [ProductTranslationType], {
    name: 'productTranslations',
    description: 'List locale overlays for a product',
  })
  @RequirePermission('translation:read')
  productTranslations(
    @Args('productId', { type: () => ID }) productId: string,
  ): Promise<ProductTranslationType[]> {
    return this.translations.listProductTranslations(productId);
  }

  @Query(() => [CategoryTranslationType], {
    name: 'categoryTranslations',
    description: 'List locale overlays for a category',
  })
  @RequirePermission('translation:read')
  categoryTranslations(
    @Args('categoryId', { type: () => ID }) categoryId: string,
  ): Promise<CategoryTranslationType[]> {
    return this.translations.listCategoryTranslations(categoryId);
  }

  @Mutation(() => ProductTranslationType, {
    name: 'upsertProductTranslation',
    description: 'Create or update a product locale overlay',
  })
  @RequirePermission('translation:update')
  upsertProductTranslation(
    @Args('input', { type: () => UpsertProductTranslationInput })
    input: UpsertProductTranslationInput,
  ): Promise<ProductTranslationType> {
    return this.translations.upsertProductTranslation(input);
  }

  @Mutation(() => CategoryTranslationType, {
    name: 'upsertCategoryTranslation',
    description: 'Create or update a category locale overlay',
  })
  @RequirePermission('translation:update')
  upsertCategoryTranslation(
    @Args('input', { type: () => UpsertCategoryTranslationInput })
    input: UpsertCategoryTranslationInput,
  ): Promise<CategoryTranslationType> {
    return this.translations.upsertCategoryTranslation(input);
  }

  @Mutation(() => Boolean, {
    name: 'deleteProductTranslation',
    description: 'Delete a product locale overlay',
  })
  @RequirePermission('translation:update')
  deleteProductTranslation(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locale', { type: () => String }) locale: string,
  ): Promise<boolean> {
    return this.translations.deleteProductTranslation(productId, locale);
  }

  @Mutation(() => Boolean, {
    name: 'deleteCategoryTranslation',
    description: 'Delete a category locale overlay',
  })
  @RequirePermission('translation:update')
  deleteCategoryTranslation(
    @Args('categoryId', { type: () => ID }) categoryId: string,
    @Args('locale', { type: () => String }) locale: string,
  ): Promise<boolean> {
    return this.translations.deleteCategoryTranslation(categoryId, locale);
  }
}
