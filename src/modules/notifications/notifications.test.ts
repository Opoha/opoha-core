import { describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationTemplateRegistry } from './notification-template.registry';
import { NotificationTemplateCode, formatMinorAmount } from './notification-template';
import { NotificationsService } from './notifications.service';
import type { NotificationProvider, NotificationSendInput } from './notification-provider';

const sampleInput: NotificationSendInput = {
  templateCode: 'order.confirmation',
  to: { email: 'buyer@example.com', name: 'Buyer' },
  subject: 'Order confirmed',
  bodyText: 'Thanks for your order.',
  data: { orderId: 'ord_1' },
};

function stubProvider(
  overrides: Partial<NotificationProvider> & Pick<NotificationProvider, 'code' | 'displayName'> = {
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

function createService(eventBus?: EventBusService): NotificationsService {
  return new NotificationsService(
    new NotificationProviderRegistry(),
    new NotificationTemplateRegistry(),
    eventBus,
  );
}

describe('NotificationsService', () => {
  it('register / get / list providers by code', () => {
    const service = createService();
    service.register(stubProvider());
    expect(service.get('smtp')?.displayName).toBe('SMTP');
    expect(service.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new NotificationProviderRegistry();
    registry.register('a', stubProvider({ code: 'smtp', displayName: 'A' }));
    expect(() => registry.register('b', stubProvider({ code: 'smtp', displayName: 'B' }))).toThrow(
      /conflict/,
    );
  });

  it('deactivates and removes by plugin', () => {
    const registry = new NotificationProviderRegistry();
    registry.register('mail-smtp', stubProvider({ code: 'smtp', displayName: 'SMTP' }));
    registry.deactivatePlugin('mail-smtp');
    expect(
      new NotificationsService(registry, new NotificationTemplateRegistry()).get('smtp'),
    ).toBeUndefined();
    registry.activatePlugin('mail-smtp');
    expect(
      new NotificationsService(registry, new NotificationTemplateRegistry()).get('smtp'),
    ).toBeDefined();
    registry.removePlugin('mail-smtp');
    expect(registry.list()).toHaveLength(0);
  });

  it('invokes provider.send and publishes NotificationQueued', async () => {
    const eventBus = new EventBusService();
    const publish = vi.spyOn(eventBus, 'publish');
    const service = createService(eventBus);
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
    const service = createService();
    const result = await service.sendOrSkip(sampleInput);
    expect(result.status).toBe('skipped');
    expect(result.metadata).toEqual({
      reason: 'no_active_notification_provider',
    });
  });

  it('rejects send without recipient email', async () => {
    const service = createService();
    service.register(stubProvider());
    await expect(
      service.send({
        templateCode: 'order.confirmation',
        to: { name: 'No email' },
      }),
    ).rejects.toThrow(/email/);
  });

  it('requires providerCode when multiple providers are active', async () => {
    const service = createService();
    service.register(stubProvider({ code: 'smtp', displayName: 'SMTP' }), 'a');
    service.register(stubProvider({ code: 'resend', displayName: 'Resend' }), 'b');
    await expect(service.send(sampleInput)).rejects.toThrow(/providerCode/);
    const result = await service.send(sampleInput, 'resend');
    expect(result.providerCode).toBe('resend');
  });
});

describe('NotificationTemplateRegistry', () => {
  it('ships default order / payment / shipment templates', () => {
    const registry = new NotificationTemplateRegistry();
    expect(
      registry
        .list()
        .map((t) => t.code)
        .sort(),
    ).toEqual(
      [
        NotificationTemplateCode.OrderConfirmation,
        NotificationTemplateCode.PaymentCaptured,
        NotificationTemplateCode.PaymentRefunded,
        NotificationTemplateCode.PaymentFailed,
        NotificationTemplateCode.ShipmentCreated,
      ].sort(),
    );
  });

  it('formats minor amounts for display', () => {
    expect(formatMinorAmount('1999', 'USD')).toBe('19.99 USD');
    expect(formatMinorAmount(50, 'THB')).toBe('0.50 THB');
  });

  it('renders order confirmation from event data', () => {
    const registry = new NotificationTemplateRegistry();
    const rendered = registry.render(NotificationTemplateCode.OrderConfirmation, {
      orderId: 'ord_42',
      currencyCode: 'USD',
      totalMinor: '1999',
      paymentMethod: 'manual',
    });
    expect(rendered.subject).toBe('Order confirmed — #ord_42');
    expect(rendered.bodyText).toContain('19.99 USD');
    expect(rendered.bodyText).toContain('manual');
    expect(rendered.bodyHtml).toContain('<strong>#ord_42</strong>');
  });

  it('allows override by code', () => {
    const registry = new NotificationTemplateRegistry();
    registry.register({
      code: NotificationTemplateCode.OrderConfirmation,
      description: 'Custom confirmation',
      render(data) {
        return {
          subject: `Custom ${String(data.orderId ?? '')}`,
          bodyText: `Hello ${String(data.customerName ?? '')}`,
        };
      },
    });
    const rendered = registry.render(NotificationTemplateCode.OrderConfirmation, {
      orderId: 'x',
      customerName: 'Ada',
    });
    expect(rendered.subject).toBe('Custom x');
    expect(rendered.bodyText).toBe('Hello Ada');
  });

  it('NotificationsService applies template when subject/body omitted', async () => {
    const sent: NotificationSendInput[] = [];
    const service = createService();
    service.register({
      code: 'smtp',
      displayName: 'SMTP',
      async send(input) {
        sent.push(input);
        return { status: 'sent', providerCode: 'smtp', messageId: 'm1' };
      },
    });

    await service.sendTemplated(
      NotificationTemplateCode.PaymentCaptured,
      { email: 'buyer@example.com' },
      {
        paymentId: 'pay_1',
        orderId: 'ord_1',
        currencyCode: 'USD',
        amountMinor: '500',
        providerCode: 'manual',
      },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]?.templateCode).toBe(NotificationTemplateCode.PaymentCaptured);
    expect(sent[0]?.subject).toBe('Payment received — order #ord_1');
    expect(sent[0]?.bodyText).toContain('5.00 USD');
    expect(sent[0]?.bodyHtml).toContain('5.00 USD');
  });

  it('rejects unknown templateCode when no subject/body supplied', async () => {
    const service = createService();
    service.register(stubProvider());
    await expect(
      service.send({
        templateCode: 'unknown.template',
        to: { email: 'a@b.com' },
      }),
    ).rejects.toThrow(/not registered/);
  });
});
