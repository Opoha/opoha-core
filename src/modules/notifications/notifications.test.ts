import { describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationsService } from './notifications.service';
import type {
  NotificationProvider,
  NotificationSendInput,
} from './notification-provider';

const sampleInput: NotificationSendInput = {
  templateCode: 'order.confirmation',
  to: { email: 'buyer@example.com', name: 'Buyer' },
  subject: 'Order confirmed',
  bodyText: 'Thanks for your order.',
  data: { orderId: 'ord_1' },
};

function stubProvider(
  overrides: Partial<NotificationProvider> &
    Pick<NotificationProvider, 'code' | 'displayName'> = {
    code: 'smtp',
    displayName: 'SMTP',
  },
): NotificationProvider {
  return {
    async send() {
      return {
        status: 'sent' as const,
        providerCode: overrides.code,
        messageId: 'msg_1',
      };
    },
    ...overrides,
  };
}

describe('NotificationsService', () => {
  it('register / get / list providers by code', () => {
    const service = new NotificationsService(new NotificationProviderRegistry());
    service.register(stubProvider());
    expect(service.get('smtp')?.displayName).toBe('SMTP');
    expect(service.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new NotificationProviderRegistry();
    registry.register('a', stubProvider({ code: 'smtp', displayName: 'A' }));
    expect(() =>
      registry.register(
        'b',
        stubProvider({ code: 'smtp', displayName: 'B' }),
      ),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new NotificationProviderRegistry();
    registry.register(
      'mail-smtp',
      stubProvider({ code: 'smtp', displayName: 'SMTP' }),
    );
    registry.deactivatePlugin('mail-smtp');
    expect(new NotificationsService(registry).get('smtp')).toBeUndefined();
    registry.activatePlugin('mail-smtp');
    expect(new NotificationsService(registry).get('smtp')).toBeDefined();
    registry.removePlugin('mail-smtp');
    expect(registry.list()).toHaveLength(0);
  });

  it('invokes provider.send and publishes NotificationQueued', async () => {
    const eventBus = new EventBusService();
    const publish = vi.spyOn(eventBus, 'publish');
    const service = new NotificationsService(
      new NotificationProviderRegistry(),
      eventBus,
    );
    service.register(stubProvider());

    const result = await service.send(sampleInput);
    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('msg_1');
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.NotificationQueued,
        aggregateType: 'notification',
        data: expect.objectContaining({
          providerCode: 'smtp',
          templateCode: 'order.confirmation',
          status: 'sent',
        }),
      }),
    );
  });

  it('sendOrSkip returns skipped when no provider is registered', async () => {
    const service = new NotificationsService(new NotificationProviderRegistry());
    const result = await service.sendOrSkip(sampleInput);
    expect(result.status).toBe('skipped');
    expect(result.metadata).toEqual({
      reason: 'no_active_notification_provider',
    });
  });

  it('rejects send without recipient email', async () => {
    const service = new NotificationsService(new NotificationProviderRegistry());
    service.register(stubProvider());
    await expect(
      service.send({
        templateCode: 'order.confirmation',
        to: { name: 'No email' },
      }),
    ).rejects.toThrow(/email/);
  });

  it('requires providerCode when multiple providers are active', async () => {
    const service = new NotificationsService(new NotificationProviderRegistry());
    service.register(stubProvider({ code: 'smtp', displayName: 'SMTP' }), 'a');
    service.register(
      stubProvider({ code: 'resend', displayName: 'Resend' }),
      'b',
    );
    await expect(service.send(sampleInput)).rejects.toThrow(/providerCode/);
    const result = await service.send(sampleInput, 'resend');
    expect(result.providerCode).toBe('resend');
  });
});
