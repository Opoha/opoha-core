import { Injectable } from '@nestjs/common';

import {
  NotificationTemplateCode,
  formatMinorAmount,
  type NotificationTemplate,
  type NotificationTemplateRendered,
} from './notification-template';

function orderConfirmationTemplate(): NotificationTemplate {
  return {
    code: NotificationTemplateCode.OrderConfirmation,
    description: 'Sent when an order is created (order confirmation).',
    render(data) {
      const orderId = String(data.orderId ?? '');
      const totalMinor = String(data.totalMinor ?? '0');
      const currencyCode = String(data.currencyCode ?? 'USD');
      const paymentMethod = String(data.paymentMethod ?? '');
      const total = formatMinorAmount(totalMinor, currencyCode);
      return {
        subject: `Order confirmed — #${orderId}`,
        bodyText: `Thanks for your order #${orderId}.\nTotal: ${total}\nPayment method: ${paymentMethod}`,
        bodyHtml: `<p>Thanks for your order <strong>#${orderId}</strong>.</p><p>Total: ${total}</p><p>Payment method: ${paymentMethod}</p>`,
      };
    },
  };
}

function paymentCapturedTemplate(): NotificationTemplate {
  return {
    code: NotificationTemplateCode.PaymentCaptured,
    description: 'Sent when a payment is captured for an order.',
    render(data) {
      const orderId = String(data.orderId ?? '');
      const amountMinor = String(data.amountMinor ?? '0');
      const currencyCode = String(data.currencyCode ?? 'USD');
      const amount = formatMinorAmount(amountMinor, currencyCode);
      return {
        subject: `Payment received — order #${orderId}`,
        bodyText: `We received your payment of ${amount} for order #${orderId}.`,
        bodyHtml: `<p>We received your payment of <strong>${amount}</strong> for order <strong>#${orderId}</strong>.</p>`,
      };
    },
  };
}

function paymentRefundedTemplate(): NotificationTemplate {
  return {
    code: NotificationTemplateCode.PaymentRefunded,
    description: 'Sent when a payment is refunded for an order.',
    render(data) {
      const orderId = String(data.orderId ?? '');
      const amountMinor = String(data.amountMinor ?? '0');
      const currencyCode = String(data.currencyCode ?? 'USD');
      const amount = formatMinorAmount(amountMinor, currencyCode);
      return {
        subject: `Refund issued — order #${orderId}`,
        bodyText: `A refund of ${amount} has been issued for order #${orderId}.`,
        bodyHtml: `<p>A refund of <strong>${amount}</strong> has been issued for order <strong>#${orderId}</strong>.</p>`,
      };
    },
  };
}

function paymentFailedTemplate(): NotificationTemplate {
  return {
    code: NotificationTemplateCode.PaymentFailed,
    description: 'Sent when a payment attempt fails for an order.',
    render(data) {
      const orderId = String(data.orderId ?? '');
      const errorMessage = String(data.errorMessage ?? 'Payment failed');
      return {
        subject: `Payment problem — order #${orderId}`,
        bodyText: `We could not process your payment for order #${orderId}: ${errorMessage}`,
        bodyHtml: `<p>We could not process your payment for order <strong>#${orderId}</strong>: ${errorMessage}</p>`,
      };
    },
  };
}

function shipmentCreatedTemplate(): NotificationTemplate {
  return {
    code: NotificationTemplateCode.ShipmentCreated,
    description: 'Sent when a shipment is created for an order (reserved for Phase 3 fulfillment).',
    render(data) {
      const orderId = String(data.orderId ?? '');
      const trackingNumber = data.trackingNumber ? String(data.trackingNumber) : undefined;
      return {
        subject: `Your order has shipped — #${orderId}`,
        bodyText: trackingNumber
          ? `Order #${orderId} has shipped. Tracking number: ${trackingNumber}`
          : `Order #${orderId} has shipped.`,
        bodyHtml: trackingNumber
          ? `<p>Order <strong>#${orderId}</strong> has shipped. Tracking number: ${trackingNumber}</p>`
          : `<p>Order <strong>#${orderId}</strong> has shipped.</p>`,
      };
    },
  };
}

/**
 * Registry of transactional notification templates (Phase 2 E-02).
 * Preloaded with the core order/payment/shipment set; core code (not plugins)
 * may register additional or override templates via `register`.
 */
@Injectable()
export class NotificationTemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  constructor() {
    for (const template of [
      orderConfirmationTemplate(),
      paymentCapturedTemplate(),
      paymentRefundedTemplate(),
      paymentFailedTemplate(),
      shipmentCreatedTemplate(),
    ]) {
      this.templates.set(template.code, template);
    }
  }

  register(template: NotificationTemplate): void {
    if (!template.code || template.code.trim().length === 0) {
      throw new Error('Notification template code is required');
    }
    this.templates.set(template.code, template);
  }

  get(code: string): NotificationTemplate | undefined {
    return this.templates.get(code);
  }

  has(code: string): boolean {
    return this.templates.has(code);
  }

  list(): readonly NotificationTemplate[] {
    return [...this.templates.values()];
  }

  render(code: string, data: Record<string, unknown>): NotificationTemplateRendered {
    const template = this.templates.get(code);
    if (!template) {
      throw new Error(`Notification template "${code}" is not registered`);
    }
    return template.render(data);
  }
}
