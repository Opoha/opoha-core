import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import type { WebhookDeliveryAttemptType, WebhookEndpointType } from './webhooks.types';
import { WebhooksService } from './webhooks.service';
import {
  CreateWebhookEndpointGqlInput,
  UpdateWebhookEndpointGqlInput,
  WebhookDeliveryAttemptGqlType,
  WebhookEndpointGqlType,
} from './webhooks.gql.types';

function toEndpointGql(row: WebhookEndpointType): WebhookEndpointGqlType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    url: row.url,
    secret: row.secret,
    eventNames: row.eventNames,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAttemptGql(row: WebhookDeliveryAttemptType): WebhookDeliveryAttemptGqlType {
  return {
    id: row.id,
    endpointId: row.endpointId,
    eventName: row.eventName,
    eventId: row.eventId,
    payloadJson: JSON.stringify(row.payload),
    status: row.status,
    attempt: row.attempt,
    nextAttemptAt: row.nextAttemptAt,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    errorMessage: row.errorMessage,
    signature: row.signature,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  };
}

@Resolver(() => WebhookEndpointGqlType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class WebhooksResolver {
  constructor(private readonly webhooks: WebhooksService) {}

  @Query(() => [WebhookEndpointGqlType], {
    name: 'webhookEndpoints',
    description: 'List outbound webhook endpoints',
  })
  @RequirePermission('webhook:read')
  async webhookEndpoints(): Promise<WebhookEndpointGqlType[]> {
    const rows = await this.webhooks.findAll({ maskSecret: true });
    return rows.map(toEndpointGql);
  }

  @Query(() => WebhookEndpointGqlType, {
    name: 'webhookEndpoint',
    description: 'Get an outbound webhook endpoint by id',
  })
  @RequirePermission('webhook:read')
  async webhookEndpoint(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WebhookEndpointGqlType> {
    return toEndpointGql(await this.webhooks.findById(id, { maskSecret: true }));
  }

  @Query(() => [WebhookDeliveryAttemptGqlType], {
    name: 'webhookDeliveryAttempts',
    description: 'List delivery attempts for an endpoint (newest first)',
  })
  @RequirePermission('webhook:read')
  async webhookDeliveryAttempts(
    @Args('endpointId', { type: () => ID }) endpointId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<WebhookDeliveryAttemptGqlType[]> {
    const rows = await this.webhooks.listDeliveryAttempts(endpointId, limit ?? 50);
    return rows.map(toAttemptGql);
  }

  @Mutation(() => WebhookEndpointGqlType, {
    name: 'createWebhookEndpoint',
    description: 'Create an outbound webhook endpoint (returns plaintext secret once)',
  })
  @RequirePermission('webhook:create')
  async createWebhookEndpoint(
    @Args('input', { type: () => CreateWebhookEndpointGqlInput })
    input: CreateWebhookEndpointGqlInput,
  ): Promise<WebhookEndpointGqlType> {
    return toEndpointGql(
      await this.webhooks.create({
        code: input.code,
        name: input.name,
        url: input.url,
        secret: input.secret,
        eventNames: input.eventNames,
        enabled: input.enabled,
      }),
    );
  }

  @Mutation(() => WebhookEndpointGqlType, {
    name: 'updateWebhookEndpoint',
    description: 'Update an outbound webhook endpoint',
  })
  @RequirePermission('webhook:update')
  async updateWebhookEndpoint(
    @Args('input', { type: () => UpdateWebhookEndpointGqlInput })
    input: UpdateWebhookEndpointGqlInput,
  ): Promise<WebhookEndpointGqlType> {
    return toEndpointGql(
      await this.webhooks.update({
        id: input.id,
        code: input.code,
        name: input.name,
        url: input.url,
        secret: input.secret,
        eventNames: input.eventNames,
        enabled: input.enabled,
      }),
    );
  }

  @Mutation(() => WebhookEndpointGqlType, {
    name: 'deleteWebhookEndpoint',
    description: 'Delete an outbound webhook endpoint',
  })
  @RequirePermission('webhook:delete')
  async deleteWebhookEndpoint(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WebhookEndpointGqlType> {
    return toEndpointGql(await this.webhooks.remove(id));
  }
}
