import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import { AuthPayload } from './auth.types';
import type { AuthUser } from './jwt/auth-user';
import { CurrentUser } from './jwt/current-user.decorator';
import { GqlAuthGuard } from './jwt/gql-auth.guard';
import { UserType } from './users/user.types';
import { UsersService } from './users/users.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Mutation(() => AuthPayload, {
    name: 'login',
    description: 'Staff login — returns JWT access token (public)',
  })
  login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(email, password);
  }

  @Query(() => UserType, {
    name: 'me',
    description: 'Current authenticated staff user',
  })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<UserType> {
    return this.usersService.findById(user.userId);
  }
}
