import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../jwt/auth-user';
import { CurrentUser } from '../jwt/current-user.decorator';
import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import {
  ApiKeyCreatedPayload,
  ApiKeyType,
  CreateApiKeyInput,
} from './api-key.types';
import { ApiKeysService } from './api-keys.service';

@Resolver(() => ApiKeyType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ApiKeysResolver {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Query(() => [ApiKeyType], {
    name: 'apiKeys',
    description: 'List API keys for the current staff user',
  })
  @RequirePermission('api-key:read')
  apiKeys(@CurrentUser() user: AuthUser): Promise<ApiKeyType[]> {
    return this.apiKeysService.listForUser(user.userId);
  }

  @Mutation(() => ApiKeyCreatedPayload, {
    name: 'createApiKey',
    description:
      'Create an API key scoped to permission keys (secret returned once)',
  })
  @RequirePermission('api-key:create')
  createApiKey(
    @CurrentUser() user: AuthUser,
    @Args('input', { type: () => CreateApiKeyInput }) input: CreateApiKeyInput,
  ): Promise<ApiKeyCreatedPayload> {
    return this.apiKeysService.create(user.userId, input);
  }

  @Mutation(() => ApiKeyType, {
    name: 'revokeApiKey',
    description: 'Revoke an API key owned by the current user',
  })
  @RequirePermission('api-key:revoke')
  revokeApiKey(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ApiKeyType> {
    return this.apiKeysService.revoke(user.userId, id);
  }
}
