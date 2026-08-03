import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../../auth/public';
import {
  CategoryType,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './category.types';
import { CategoriesService } from './categories.service';

@Resolver(() => CategoryType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Query(() => [CategoryType], {
    name: 'categories',
    description:
      'List catalog categories. Optional storeId returns shared + store-owned rows for that store.',
  })
  @RequirePermission('category:read')
  categories(
    @Args('storeId', { type: () => ID, nullable: true }) storeId?: string,
  ): Promise<CategoryType[]> {
    return this.categoriesService.findAll(storeId);
  }

  @Query(() => CategoryType, {
    name: 'category',
    description: 'Get catalog category by id',
  })
  @RequirePermission('category:read')
  category(@Args('id', { type: () => ID }) id: string): Promise<CategoryType> {
    return this.categoriesService.findById(id);
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
