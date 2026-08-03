import { BadRequestException, Injectable, Optional } from '@nestjs/common';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationTemplateRegistry } from './notification-template.registry';
import type {
  NotificationProvider,
  NotificationRecipient,
  NotificationSendInput,
  NotificationSendResult,
} from './notification-provider';
import type {
  NotificationTemplate,
  NotificationTemplateRendered,
} from './notification-template';

/**
 * Notifications orchestration — providers, templates, and send.
 * Event listeners (E-03) build on sendTemplated / sendOrSkip.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly registry: NotificationProviderRegistry,
    private readonly templates: NotificationTemplateRegistry,
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

  /** Lookup a registered transactional template. */
  getTemplate(code: string): NotificationTemplate | undefined {
    return this.templates.get(code);
  }

  /** List registered transactional templates. */
  listTemplates(): readonly NotificationTemplate[] {
    return this.templates.list();
  }

  /** Register or replace a transactional template. */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.register(template);
  }

  /**
   * Render a registered template. Throws BadRequestException when unknown.
   */
  renderTemplate(
    code: string,
    data: Record<string, unknown> = {},
  ): NotificationTemplateRendered {
    try {
      return this.templates.render(code, data);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : `Unknown template "${code}"`,
      );
    }
  }

  /**
   * Send via a specific provider, or the sole active provider when omitted.
   * When `templateCode` is set, subject/body are filled from the registry
   * unless the caller already supplied them.
   * Publishes NotificationQueued after a successful handoff (queued/sent).
   */
  async send(
    input: NotificationSendInput,
    providerCode?: string,
  ): Promise<NotificationSendResult> {
    const resolved = this.applyTemplate(input);
    this.requireSendInput(resolved);
    const provider = this.resolveProvider(providerCode);

    let result: NotificationSendResult;
    try {
      result = await provider.send(resolved);
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
      await this.publishQueued(resolved, result);
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
    const resolved = this.applyTemplate(input);
    this.requireSendInput(resolved);
    if (!this.hasActiveProvider()) {
      return {
        status: 'skipped',
        providerCode: providerCode ?? 'none',
        metadata: { reason: 'no_active_notification_provider' },
      };
    }
    return this.send(resolved, providerCode);
  }

  /**
   * Convenience: render `templateCode` and send (or skip) to recipients.
   */
  async sendTemplated(
    templateCode: string,
    to: NotificationRecipient | NotificationRecipient[],
    data: Record<string, unknown> = {},
    providerCode?: string,
  ): Promise<NotificationSendResult> {
    return this.sendOrSkip(
      {
        templateCode,
        to,
        data,
      },
      providerCode,
    );
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

  /**
   * Fill subject/body from the template registry when templateCode is set
   * and the caller did not already supply those fields.
   */
  private applyTemplate(input: NotificationSendInput): NotificationSendInput {
    const code = input.templateCode?.trim();
    if (!code) {
      return input;
    }
    const needsSubject = !(input.subject && input.subject.trim().length > 0);
    const needsBodyText = !(input.bodyText && input.bodyText.trim().length > 0);
    const needsBodyHtml = input.bodyHtml === undefined;
    if (!needsSubject && !needsBodyText && !needsBodyHtml) {
      return input;
    }
    if (!this.templates.has(code)) {
      if (
        (input.subject && input.subject.trim().length > 0) ||
        (input.bodyText && input.bodyText.trim().length > 0) ||
        (input.bodyHtml && input.bodyHtml.trim().length > 0)
      ) {
        return input;
      }
      throw new BadRequestException(
        `Notification template "${code}" is not registered`,
      );
    }
    const rendered = this.templates.render(code, input.data ?? {});
    return {
      ...input,
      subject: needsSubject ? rendered.subject : input.subject,
      bodyText: needsBodyText ? rendered.bodyText : input.bodyText,
      bodyHtml: needsBodyHtml ? rendered.bodyHtml : input.bodyHtml,
    };
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
