import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { CreateUserInput, UpdateUserInput, UserType } from './user.types';
import { UsersService } from './users.service';

@Resolver(() => UserType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserType], {
    name: 'users',
    description: 'List staff users',
  })
  @RequirePermission('user:read')
  users(): Promise<UserType[]> {
    return this.usersService.findAll();
  }

  @Query(() => UserType, {
    name: 'user',
    description: 'Get staff user by id',
  })
  @RequirePermission('user:read')
  user(@Args('id', { type: () => ID }) id: string): Promise<UserType> {
    return this.usersService.findById(id);
  }

  @Mutation(() => UserType, {
    name: 'createUser',
    description: 'Create staff user',
  })
  @RequirePermission('user:create')
  createUser(
    @Args('input', { type: () => CreateUserInput }) input: CreateUserInput,
  ): Promise<UserType> {
    return this.usersService.create(input);
  }

  @Mutation(() => UserType, {
    name: 'updateUser',
    description: 'Update staff user',
  })
  @RequirePermission('user:update')
  updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateUserInput }) input: UpdateUserInput,
  ): Promise<UserType> {
    return this.usersService.update(id, input);
  }

  @Mutation(() => UserType, {
    name: 'deleteUser',
    description: 'Delete staff user',
  })
  @RequirePermission('user:delete')
  deleteUser(@Args('id', { type: () => ID }) id: string): Promise<UserType> {
    return this.usersService.remove(id);
  }
}
