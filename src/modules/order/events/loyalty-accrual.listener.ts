import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { DomainEvent } from '../../event-bus/domain-event';
import { CoreEventName } from '../../event-bus/event-catalog';
import { EventBusService } from '../../event-bus/event-bus.service';
import { LoyaltyService } from '../../loyalty/public';
import type { PaymentCapturedData } from '../../payment-engine/events/payment-events';
import { OrderEntity } from '../entities/order.entity';

/**
 * Accrue loyalty points when payment is captured (C-03).
 * Uses order totalMinor (payable after gift card / loyalty redeem).
 */
@Injectable()
export class LoyaltyAccrualListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly loyalty: LoyaltyService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(CoreEventName.PaymentCaptured, (event) =>
      this.onPaymentCaptured(event as DomainEvent<PaymentCapturedData>),
    );
  }

  private async onPaymentCaptured(event: DomainEvent<PaymentCapturedData>): Promise<void> {
    const orderId = event.data.orderId;
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order?.customerId) {
      return;
    }

    await this.loyalty.accrueFromOrderCapture({
      customerId: order.customerId,
      orderId: order.id,
      totalMinor: String(order.totalMinor ?? '0'),
    });
  }
}
