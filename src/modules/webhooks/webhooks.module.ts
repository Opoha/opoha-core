import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { webhookEntities } from './entities';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import {
  createFetchWebhookHttpClient,
  WEBHOOK_HTTP_CLIENT,
} from './webhook-http.client';
import { WebhooksResolver } from './webhooks.resolver';
import { WebhooksService } from './webhooks.service';

/**
 * Core `webhooks` module (Phase 8 D-01–D-03).
 * Outbound subscriptions, HMAC signing, retries, dead-letter, GraphQL CRUD.
 */
@Module({
  imports: [
    AuthModule,
    EventBusModule,
    TypeOrmModule.forFeature([...webhookEntities]),
  ],
  providers: [
    WebhooksService,
    WebhookDeliveryWorker,
    WebhookDispatcherService,
    WebhooksResolver,
    {
      provide: WEBHOOK_HTTP_CLIENT,
      useFactory: () => createFetchWebhookHttpClient(),
    },
  ],
  exports: [
    WebhooksService,
    WebhookDeliveryWorker,
    WebhookDispatcherService,
    TypeOrmModule,
  ],
})
export class WebhooksModule {}
