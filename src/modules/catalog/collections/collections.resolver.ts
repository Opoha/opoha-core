import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../../auth/public';
import { CollectionType, CreateCollectionInput, UpdateCollectionInput } from './collection.types';
import { CollectionsService } from './collections.service';

@Resolver(() => CollectionType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CollectionsResolver {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Query(() => [CollectionType], {
    name: 'collections',
    description: 'List catalog collections',
  })
  @RequirePermission('collection:read')
  collections(): Promise<CollectionType[]> {
    return this.collectionsService.findAll();
  }

  @Query(() => CollectionType, {
    name: 'collection',
    description: 'Get catalog collection by id',
  })
  @RequirePermission('collection:read')
  collection(@Args('id', { type: () => ID }) id: string): Promise<CollectionType> {
    return this.collectionsService.findById(id);
  }

  @Mutation(() => CollectionType, {
    name: 'createCollection',
    description: 'Create a catalog collection',
  })
  @RequirePermission('collection:create')
  createCollection(
    @Args('input', { type: () => CreateCollectionInput })
    input: CreateCollectionInput,
  ): Promise<CollectionType> {
    return this.collectionsService.create(input);
  }

  @Mutation(() => CollectionType, {
    name: 'updateCollection',
    description: 'Update a catalog collection',
  })
  @RequirePermission('collection:update')
  updateCollection(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateCollectionInput })
    input: UpdateCollectionInput,
  ): Promise<CollectionType> {
    return this.collectionsService.update(id, input);
  }

  @Mutation(() => CollectionType, {
    name: 'deleteCollection',
    description: 'Delete a catalog collection',
  })
  @RequirePermission('collection:delete')
  deleteCollection(@Args('id', { type: () => ID }) id: string): Promise<CollectionType> {
    return this.collectionsService.remove(id);
  }
}
