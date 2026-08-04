import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import { AuthPayload } from './auth.types';
import type { AuthUser } from './jwt/auth-user';
import { CurrentUser } from './jwt/current-user.decorator';
import { GqlAuthGuard } from './jwt/gql-auth.guard';
import { PermissionsService } from './permissions/permissions.service';
import { UserType } from './users/user.types';
import { UsersService } from './users/users.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Mutation(() => AuthPayload, {
    name: 'login',
    description: 'Staff login — returns JWT access token + opaque refresh token (public)',
  })
  login(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(email, password);
  }

  @Mutation(() => AuthPayload, {
    name: 'refresh',
    description:
      'Rotate refresh token and issue a new access + refresh pair (public; revoked tokens rejected)',
  })
  refresh(
    @Args('refreshToken', { type: () => String }) refreshToken: string,
  ): Promise<AuthPayload> {
    return this.authService.refresh(refreshToken);
  }

  @Mutation(() => Boolean, {
    name: 'logout',
    description: 'Revoke a refresh token (public; idempotent)',
  })
  logout(@Args('refreshToken', { type: () => String }) refreshToken: string): Promise<boolean> {
    return this.authService.logout(refreshToken);
  }

  @Query(() => UserType, {
    name: 'me',
    description: 'Current authenticated staff user',
  })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<UserType> {
    return this.usersService.findById(user.userId);
  }

  @Query(() => [String], {
    name: 'myPermissions',
    description: 'Permission keys for the current staff user (role-derived or API-key scoped)',
  })
  @UseGuards(GqlAuthGuard)
  myPermissions(@CurrentUser() user: AuthUser): Promise<string[]> {
    if (user.permissions?.length) {
      return Promise.resolve([...user.permissions].sort());
    }
    return this.permissionsService.listKeysForUser(user.userId);
  }
}
