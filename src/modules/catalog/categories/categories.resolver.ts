import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../../auth/public';
import { StoreCatalogModeGql } from '../../config/public';
import type { StoreCatalogMode } from '../../config/public';
import { resolveLocalePreference } from '../translations/locale';
import {
  CategoryType,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.types';
import { CategoriesService } from './categories.service';

type GqlRequestContext = {
  req?: { headers?: Record<string, string | string[] | undefined> };
};

@Resolver(() => CategoryType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Query(() => [CategoryType], {
    name: 'categories',
    description:
      'List catalog categories. Optional storeId scopes the list; optional catalogMode overrides channel settings (shared = shared∪owned, isolated = owned-only). Optional locale (or Accept-Language) overlays translations.',
  })
  @RequirePermission('category:read')
  categories(
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
  ): Promise<CategoryType[]> {
    const resolved = resolveLocalePreference({
      localeArg: locale,
      headers: ctx?.req?.headers,
    });
    return this.categoriesService.findAll(storeId, catalogMode, resolved);
  }

  @Query(() => CategoryType, {
    name: 'category',
    description:
      'Get catalog category by id. Optional locale (or Accept-Language) overlays translations.',
  })
  @RequirePermission('category:read')
  category(
    @Args('id', { type: () => ID }) id: string,
    @Args('locale', {
      type: () => String,
      nullable: true,
      description: 'BCP 47 locale; falls back to Accept-Language when omitted',
    })
    locale?: string,
    @Context() ctx?: GqlRequestContext,
  ): Promise<CategoryType> {
    const resolved = resolveLocalePreference({
      localeArg: locale,
      headers: ctx?.req?.headers,
    });
    return this.categoriesService.findById(id, resolved);
  }

  @Mutation(() => CategoryType, {
    name: 'createCategory',
    description: 'Create a catalog category',
  })
  @RequirePermission('category:create')
  createCategory(
    @Args('input', { type: () => CreateCategoryInput })
    input: CreateCategoryInput,
  ): Promise<CategoryType> {
    return this.categoriesService.create(input);
  }

  @Mutation(() => CategoryType, {
    name: 'updateCategory',
    description: 'Update a catalog category',
  })
  @RequirePermission('category:update')
  updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateCategoryInput })
    input: UpdateCategoryInput,
  ): Promise<CategoryType> {
    return this.categoriesService.update(id, input);
  }

  @Mutation(() => CategoryType, {
    name: 'deleteCategory',
    description: 'Delete a catalog category',
  })
  @RequirePermission('category:delete')
  deleteCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CategoryType> {
    return this.categoriesService.remove(id);
  }
}
