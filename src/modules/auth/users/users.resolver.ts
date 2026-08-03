import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { CreateUserInput, UpdateUserInput, UserType } from './user.types';
import { UsersService } from './users.service';

@Resolver(() => UserType)
@UseGuards(GqlAuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserType], {
    name: 'users',
    description: 'List staff users (authenticated staff only)',
  })
  users(): Promise<UserType[]> {
    return this.usersService.findAll();
  }

  @Query(() => UserType, {
    name: 'user',
    description: 'Get staff user by id (authenticated staff only)',
  })
  user(@Args('id', { type: () => ID }) id: string): Promise<UserType> {
    return this.usersService.findById(id);
  }

  @Mutation(() => UserType, {
    name: 'createUser',
    description: 'Create staff user (authenticated staff only)',
  })
  createUser(@Args('input', { type: () => CreateUserInput }) input: CreateUserInput): Promise<UserType> {
    return this.usersService.create(input);
  }

  @Mutation(() => UserType, {
    name: 'updateUser',
    description: 'Update staff user (authenticated staff only)',
  })
  updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateUserInput }) input: UpdateUserInput,
  ): Promise<UserType> {
    return this.usersService.update(id, input);
  }

  @Mutation(() => UserType, {
    name: 'deleteUser',
    description: 'Delete staff user (authenticated staff only)',
  })
  deleteUser(@Args('id', { type: () => ID }) id: string): Promise<UserType> {
    return this.usersService.remove(id);
  }
}
