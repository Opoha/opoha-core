import { BadRequestException, Injectable, Optional } from '@nestjs/common';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { NotificationProviderRegistry } from './notification-provider.registry';
import type {
  NotificationProvider,
  NotificationSendInput,
  NotificationSendResult,
} from './notification-provider';

/**
 * Notifications orchestration — register / get / list providers + send.
 * Templates (E-02) and event listeners (E-03) build on this service.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly registry: NotificationProviderRegistry,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  register(provider: NotificationProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): NotificationProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly NotificationProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }

  /** True when at least one notification provider is active. */
  hasActiveProvider(): boolean {
    return this.registry.list(true).length > 0;
  }

  /**
   * Send via a specific provider, or the sole active provider when omitted.
   * Publishes NotificationQueued after a successful handoff (queued/sent).
   */
  async send(
    input: NotificationSendInput,
    providerCode?: string,
  ): Promise<NotificationSendResult> {
    this.requireSendInput(input);
    const provider = this.resolveProvider(providerCode);

    let result: NotificationSendResult;
    try {
      result = await provider.send(input);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : `Notification provider "${provider.code}" failed to send`,
      );
    }

    if (!result.providerCode) {
      result = { ...result, providerCode: provider.code };
    }

    if (result.status === 'queued' || result.status === 'sent') {
      await this.publishQueued(input, result);
    }

    return result;
  }

  /**
   * Soft send: when no provider is registered, returns skipped so callers
   * (order/payment listeners) do not fail until a plugin registers.
   */
  async sendOrSkip(
    input: NotificationSendInput,
    providerCode?: string,
  ): Promise<NotificationSendResult> {
    this.requireSendInput(input);
    if (!this.hasActiveProvider()) {
      return {
        status: 'skipped',
        providerCode: providerCode ?? 'none',
        metadata: { reason: 'no_active_notification_provider' },
      };
    }
    return this.send(input, providerCode);
  }

  private resolveProvider(providerCode?: string): NotificationProvider {
    if (providerCode) {
      const provider = this.registry.get(providerCode);
      if (!provider) {
        throw new BadRequestException(
          `Notification provider "${providerCode}" is not registered or inactive`,
        );
      }
      return provider;
    }
    const active = this.registry.list(true);
    if (active.length === 0) {
      throw new BadRequestException('No active notification provider');
    }
    if (active.length > 1 && !providerCode) {
      throw new BadRequestException(
        'Multiple notification providers are active; specify providerCode',
      );
    }
    return active[0]!.provider;
  }

  private requireSendInput(input: NotificationSendInput): void {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    if (recipients.length === 0) {
      throw new BadRequestException('Notification recipient is required');
    }
    const channel = input.channel ?? 'email';
    if (channel === 'email') {
      const hasEmail = recipients.some(
        (r) => r.email && r.email.trim().length > 0,
      );
      if (!hasEmail) {
        throw new BadRequestException(
          'At least one recipient email is required for email notifications',
        );
      }
    }
    const hasContent =
      (input.subject && input.subject.trim().length > 0) ||
      (input.bodyText && input.bodyText.trim().length > 0) ||
      (input.bodyHtml && input.bodyHtml.trim().length > 0) ||
      (input.templateCode && input.templateCode.trim().length > 0);
    if (!hasContent) {
      throw new BadRequestException(
        'Notification requires subject, body, or templateCode',
      );
    }
  }

  private async publishQueued(
    input: NotificationSendInput,
    result: NotificationSendResult,
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    await this.eventBus.publish({
      eventName: CoreEventName.NotificationQueued,
      aggregateType: 'notification',
      aggregateId: result.messageId ?? input.idempotencyKey ?? 'unknown',
      data: {
        providerCode: result.providerCode,
        status: result.status,
        templateCode: input.templateCode,
        channel: input.channel ?? 'email',
        recipientCount: recipients.length,
        messageId: result.messageId,
      },
    });
  }
}
