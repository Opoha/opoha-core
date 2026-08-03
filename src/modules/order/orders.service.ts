import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { B2bQuoteService, CompanyService } from '../b2b/public';
import { GiftCardService } from '../gift-cards/public';
import { InventoryService } from '../inventory/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { LoyaltyService } from '../loyalty/public';
import { PaymentEngine } from '../payment-engine/public';
import type { StoreContextRef } from '../stores/public';
import { StoreService } from '../stores/public';
import { TaxEngine } from '../tax-engine/public';
import { PromotionsEngine } from '../promotions-engine/public';
import {
  applyGiftCardToTotals,
  applyLoyaltyToTotals,
  buildPromotionApplyInput,
  buildTaxCalculateInput,
  lineSubtotalMinor,
  totalsWithTax,
} from './checkout-tax';
import { CartService } from './cart.service';
import {
  assertOrderSource,
  type OrderSource,
} from './entities/order-source';
import {
  canTransitionOrderStatus,
  isOrderStatus,
  type OrderStatus,
} from './entities/order-status';
import { OrderLineEntity } from './entities/order-line.entity';
import { OrderEntity } from './entities/order.entity';
import type {
  OrderLineType,
  OrderType,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from './order.types';
import {
  assertStoreContextMatchesCart,
  requireActiveStore,
  resolveContextStoreId,
} from './store-scope';

function lineTotalMinor(unitPriceMinor: string, quantity: number): string {
  return (BigInt(unitPriceMinor) * BigInt(quantity)).toString();
}

function toLineType(row: OrderLineEntity): OrderLineType {
  return {
    id: row.id,
    orderId: row.orderId,
    variantId: row.variantId,
    quantity: row.quantity,
    unitPriceMinor: String(row.unitPriceMinor),
    lineTotalMinor: String(row.lineTotalMinor),
    createdAt: row.createdAt,
  };
}

function parseOrderSource(value: string | undefined): OrderSource {
  if (value === undefined || value.trim() === '') {
    return 'web';
  }
  try {
    return assertOrderSource(value.trim());
  } catch {
    throw new BadRequestException(
      `orderSource must be one of: web, pos, marketplace (got "${value}")`,
    );
  }
}

function toOrderType(row: OrderEntity, lines: OrderLineEntity[]): OrderType {
  return {
    id: row.id,
    storeId: row.storeId,
    customerId: row.customerId,
    companyId: row.companyId ?? null,
    cartId: row.cartId,
    orderSource: row.orderSource ?? 'web',
    status: row.status,
    currencyCode: row.currencyCode,
    subtotalMinor: String(row.subtotalMinor),
    taxMinor: String(row.taxMinor),
    shippingMinor: String(row.shippingMinor),
    discountMinor: String(row.discountMinor ?? '0'),
    couponCode: row.couponCode ?? null,
    giftCardCode: row.giftCardCode ?? null,
    giftCardMinor: String(row.giftCardMinor ?? '0'),
    loyaltyPointsRedeemed: row.loyaltyPointsRedeemed ?? 0,
    loyaltyMinor: String(row.loyaltyMinor ?? '0'),
    shippingMethodCode: row.shippingMethodCode ?? null,
    shippingRateCode: row.shippingRateCode ?? null,
    totalMinor: String(row.totalMinor),
    lines: lines.map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Resolve GraphQL paymentMethod alias → provider code + capture policy. */
function resolvePaymentPath(paymentMethod: string): {
  providerCode: string;
  captureImmediately: boolean;
  methodLabel: string;
} {
  if (paymentMethod === 'zero') {
    return {
      providerCode: 'manual',
      captureImmediately: true,
      methodLabel: 'zero',
    };
  }
  return {
    providerCode: paymentMethod,
    captureImmediately: false,
    methodLabel: paymentMethod,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly lines: Repository<OrderLineEntity>,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly eventBus: EventBusService,
    private readonly payments: PaymentEngine,
    private readonly tax: TaxEngine,
    private readonly promotions: PromotionsEngine,
    private readonly giftCards: GiftCardService,
    private readonly loyalty: LoyaltyService,
    private readonly stores: StoreService,
    private readonly companies: CompanyService,
    private readonly quotes: B2bQuoteService,
  ) {}

  async findAll(storeId?: string | null): Promise<OrderType[]> {
    const scope = storeId?.trim() || undefined;
    const rows = await this.orders.find({
      where: scope ? { storeId: scope } : undefined,
      order: { createdAt: 'ASC' },
    });
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return this.hydrate(row);
  }

  /**
   * Place order from a locked cart (Phase 2 A-04).
   * Authorizes via PaymentEngine; `zero` also captures immediately.
   * B2B carts with `companyId` create a `draft` order (F-03) — no payment until
   * `approveB2bOrder` → `confirmB2bOrder`.
   */
  async placeOrder(
    input: PlaceOrderInput,
    context?: StoreContextRef | null,
  ): Promise<OrderType> {
    const paymentMethod = (input.paymentMethod ?? 'manual').trim();
    if (!paymentMethod) {
      throw new BadRequestException('paymentMethod is required');
    }
    const orderSource = parseOrderSource(input.orderSource);

    const { providerCode, captureImmediately, methodLabel } =
      resolvePaymentPath(paymentMethod);

    const { cart, lines } = await this.carts.getEntityWithLines(input.cartId);

    if (cart.status !== 'locked') {
      throw new BadRequestException(
        `Cart ${input.cartId} must be locked via prepareCheckout before placing an order (status=${cart.status})`,
      );
    }
    if (lines.length === 0) {
      throw new BadRequestException(`Cart ${input.cartId} has no lines`);
    }
    if (!cart.storeId) {
      throw new BadRequestException(
        `Cart ${input.cartId} has no storeId; recreate the cart with a store context`,
      );
    }

    await requireActiveStore(this.stores, cart.storeId);
    const contextStoreId = await resolveContextStoreId(this.stores, context);
    assertStoreContextMatchesCart({
      cartStoreId: cart.storeId,
      contextStoreId,
    });

    for (const line of lines) {
      if (!line.reservationId) {
        throw new BadRequestException(
          `Cart line ${line.id} has no inventory reservation; run prepareCheckout first`,
        );
      }
    }

    const subtotal = lineSubtotalMinor(lines);
    const shippingMinor = BigInt(String(cart.shippingMinor ?? '0'));

    const promoInput = buildPromotionApplyInput(cart, lines);
    const promoResult = await this.promotions.applyOrZero(promoInput);

    const taxInput = buildTaxCalculateInput(cart, lines);
    const taxResult = await this.tax.calculateOrZero(
      taxInput,
      cart.taxProviderCode ?? undefined,
    );
    const totalsBase = totalsWithTax({
      currencyCode: cart.currencyCode,
      subtotalMinor: subtotal,
      shippingMinor,
      tax: taxResult,
      discountMinor: BigInt(String(promoResult.discountMinor || '0')),
      freeShipping: promoResult.freeShipping === true,
    });

    let giftCardMinor = 0n;
    const giftCode = cart.giftCardCode?.trim();
    if (giftCode) {
      const quote = await this.giftCards.quoteRedeem({
        code: giftCode,
        currencyCode: cart.currencyCode,
        maxAmountMinor: totalsBase.totalMinor,
      });
      giftCardMinor = BigInt(String(quote.appliedMinor || '0'));
    }
    let totals = applyGiftCardToTotals(totalsBase, giftCardMinor);

    let loyaltyPointsRedeemed = 0;
    let loyaltyMinor = 0n;
    const requestedLoyalty = cart.loyaltyPointsToRedeem ?? 0;
    if (requestedLoyalty > 0 && cart.customerId) {
      const quote = await this.loyalty.quoteRedeem({
        customerId: cart.customerId,
        points: requestedLoyalty,
        maxAmountMinor: totals.totalMinor,
      });
      loyaltyPointsRedeemed = quote.pointsToRedeem;
      loyaltyMinor = BigInt(String(quote.appliedMinor || '0'));
      totals = applyLoyaltyToTotals(totals, loyaltyMinor);
    }

    const taxMinor = BigInt(totals.taxMinor);
    const discountMinor = BigInt(totals.discountMinor);
    const effectiveShipping = BigInt(totals.shippingMinor);
    const totalMinor = BigInt(totals.totalMinor);

    if (methodLabel === 'zero' && totalMinor !== 0n && !cart.companyId) {
      throw new BadRequestException(
        `Zero payment requires a zero total (got ${totalMinor.toString()})`,
      );
    }

    // B2B path (F-03): draft order, defer payment + gift/loyalty redeem.
    if (cart.companyId) {
      if (!cart.customerId) {
        throw new BadRequestException(
          'B2B carts require a customerId for company membership checks',
        );
      }
      await this.companies.assertCanBuy(cart.companyId, cart.customerId);
      await this.companies.assertWithinCreditLimit(
        cart.companyId,
        totalMinor.toString(),
      );

      const order = await this.orders.save(
        this.orders.create({
          storeId: cart.storeId,
          customerId: cart.customerId,
          companyId: cart.companyId,
          cartId: cart.id,
          orderSource,
          status: 'draft',
          currencyCode: cart.currencyCode,
          subtotalMinor: subtotal.toString(),
          taxMinor: taxMinor.toString(),
          shippingMinor: effectiveShipping.toString(),
          discountMinor: discountMinor.toString(),
          couponCode: cart.couponCode ?? null,
          giftCardCode: giftCode ? giftCode.toUpperCase() : null,
          giftCardMinor: giftCardMinor.toString(),
          loyaltyPointsRedeemed,
          loyaltyMinor: loyaltyMinor.toString(),
          shippingMethodCode: cart.shippingMethodCode ?? null,
          shippingRateCode: cart.shippingRateCode ?? null,
          totalMinor: totalMinor.toString(),
        }),
      );

      await this.lines.save(
        lines.map((line) =>
          this.lines.create({
            orderId: order.id,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPriceMinor: String(line.unitPriceMinor),
            lineTotalMinor: lineTotalMinor(
              String(line.unitPriceMinor),
              line.quantity,
            ),
          }),
        ),
      );

      for (const line of lines) {
        await this.inventory.commit(line.reservationId!);
      }
      await this.carts.setStatus(cart.id, 'converted');

      await this.eventBus.publish({
        eventName: CoreEventName.OrderCreated,
        aggregateType: 'order',
        aggregateId: order.id,
        data: {
          orderId: order.id,
          cartId: cart.id,
          storeId: cart.storeId,
          customerId: cart.customerId,
          orderSource,
          status: 'draft',
          currencyCode: cart.currencyCode,
          totalMinor: totalMinor.toString(),
          paymentMethod: 'b2b_approval',
        },
      });

      await this.publishTimeline({
        orderId: order.id,
        type: 'created',
        fromStatus: null,
        toStatus: 'draft',
        paymentMethod: 'b2b_approval',
        note: `B2B draft order for company ${cart.companyId}; awaiting approval`,
      });

      return this.hydrate(order);
    }

    if (!this.payments.get(providerCode)) {
      throw new BadRequestException(
        `Payment provider "${providerCode}" is not registered or inactive`,
      );
    }

    const order = await this.orders.save(
      this.orders.create({
        storeId: cart.storeId,
        customerId: cart.customerId,
        companyId: null,
        cartId: cart.id,
        orderSource,
        status: 'pending',
        currencyCode: cart.currencyCode,
        subtotalMinor: subtotal.toString(),
        taxMinor: taxMinor.toString(),
        shippingMinor: effectiveShipping.toString(),
        discountMinor: discountMinor.toString(),
        couponCode: cart.couponCode ?? null,
        giftCardCode: giftCode ? giftCode.toUpperCase() : null,
        giftCardMinor: giftCardMinor.toString(),
        loyaltyPointsRedeemed,
        loyaltyMinor: loyaltyMinor.toString(),
        shippingMethodCode: cart.shippingMethodCode ?? null,
        shippingRateCode: cart.shippingRateCode ?? null,
        totalMinor: totalMinor.toString(),
      }),
    );

    await this.lines.save(
      lines.map((line) =>
        this.lines.create({
          orderId: order.id,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceMinor: String(line.unitPriceMinor),
          lineTotalMinor: lineTotalMinor(
            String(line.unitPriceMinor),
            line.quantity,
          ),
        }),
      ),
    );

    if (giftCode && giftCardMinor > 0n) {
      try {
        await this.giftCards.redeem({
          code: giftCode,
          amountMinor: giftCardMinor.toString(),
          orderId: order.id,
          note: `Redeemed on order ${order.id}`,
        });
      } catch (err) {
        await this.transitionStatus(order.id, 'cancelled', {
          note: 'Gift card redeem failed during placeOrder',
        });
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Gift card redeem failed',
        );
      }
    }

    if (loyaltyPointsRedeemed > 0 && cart.customerId) {
      try {
        await this.loyalty.redeem({
          customerId: cart.customerId,
          points: loyaltyPointsRedeemed,
          orderId: order.id,
          note: `Redeemed on order ${order.id}`,
        });
      } catch (err) {
        await this.transitionStatus(order.id, 'cancelled', {
          note: 'Loyalty redeem failed during placeOrder',
        });
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Loyalty redeem failed',
        );
      }
    }

    let payment;
    try {
      payment = await this.payments.authorize({
        providerCode,
        orderId: order.id,
        amount: {
          amountMinor: totalMinor.toString(),
          currencyCode: cart.currencyCode,
        },
        idempotencyKey: `place-order:${order.id}`,
        metadata: {
          cartId: cart.id,
          paymentMethod: methodLabel,
        },
      });

      if (payment.status === 'failed') {
        throw new BadRequestException(
          payment.errorMessage ?? 'Payment authorization failed',
        );
      }

      if (captureImmediately && payment.status !== 'captured') {
        payment = await this.payments.capture({
          paymentId: payment.id,
          idempotencyKey: `place-order-capture:${order.id}`,
        });
        if (payment.status === 'failed') {
          throw new BadRequestException(
            payment.errorMessage ?? 'Payment capture failed',
          );
        }
      }
    } catch (err) {
      await this.transitionStatus(order.id, 'cancelled', {
        note: `Payment failed during placeOrder (${methodLabel})`,
      });
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Payment processing failed',
      );
    }

    for (const line of lines) {
      await this.inventory.commit(line.reservationId!);
    }

    await this.carts.setStatus(cart.id, 'converted');

    await this.eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: order.id,
      data: {
        orderId: order.id,
        cartId: cart.id,
        storeId: cart.storeId,
        customerId: cart.customerId,
        orderSource,
        status: 'pending',
        currencyCode: cart.currencyCode,
        totalMinor: totalMinor.toString(),
        paymentMethod: methodLabel,
      },
    });

    await this.publishTimeline({
      orderId: order.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'pending',
      paymentMethod: methodLabel,
      note: `Order placed via ${methodLabel} payment`,
    });

    const paymentNote =
      methodLabel === 'zero'
        ? `Zero-total order; payment ${payment.id} captured via PaymentEngine`
        : `Payment ${payment.id} ${payment.status} via ${providerCode}`;

    await this.publishTimeline({
      orderId: order.id,
      type: 'payment_recorded',
      fromStatus: 'pending',
      toStatus: 'pending',
      paymentMethod: methodLabel,
      note: paymentNote,
    });

    return this.transitionStatus(order.id, 'confirmed', {
      note: `Auto-confirmed after ${methodLabel} payment path (${payment.status})`,
    });
  }

  /**
   * Convert an accepted B2B quote into a draft company order (F-05 foundation).
   * Skips cart/inventory reservation — full CPQ/checkout path deferred.
   */
  async convertB2bQuote(input: { quoteId: string }): Promise<OrderType> {
    const { quote, lines, subtotalMinor } =
      await this.quotes.requireAcceptedForConvert(input.quoteId);

    await this.companies.assertCanBuy(quote.companyId, quote.customerId);
    await this.companies.assertWithinCreditLimit(
      quote.companyId,
      subtotalMinor,
    );
    await requireActiveStore(this.stores, quote.storeId);

    const order = await this.orders.save(
      this.orders.create({
        storeId: quote.storeId,
        customerId: quote.customerId,
        companyId: quote.companyId,
        cartId: null,
        orderSource: 'web',
        status: 'draft',
        currencyCode: quote.currencyCode,
        subtotalMinor,
        taxMinor: '0',
        shippingMinor: '0',
        discountMinor: '0',
        couponCode: null,
        giftCardCode: null,
        giftCardMinor: '0',
        loyaltyPointsRedeemed: 0,
        loyaltyMinor: '0',
        shippingMethodCode: null,
        shippingRateCode: null,
        totalMinor: subtotalMinor,
      }),
    );

    await this.lines.save(
      lines.map((line) =>
        this.lines.create({
          orderId: order.id,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceMinor: String(line.unitPriceMinor),
          lineTotalMinor: lineTotalMinor(
            String(line.unitPriceMinor),
            line.quantity,
          ),
        }),
      ),
    );

    await this.quotes.markConverted(quote.id, order.id);

    const poNote = quote.poNumber ? `; buyer PO ${quote.poNumber}` : '';
    await this.eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: order.id,
      data: {
        orderId: order.id,
        cartId: null,
        storeId: quote.storeId,
        customerId: quote.customerId,
        orderSource: 'web',
        status: 'draft',
        currencyCode: quote.currencyCode,
        totalMinor: subtotalMinor,
        paymentMethod: 'b2b_quote',
      },
    });

    await this.publishTimeline({
      orderId: order.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'draft',
      paymentMethod: 'b2b_quote',
      note: `Draft order from B2B quote ${quote.id}${poNote}; awaiting approval`,
    });

    return this.hydrate(order);
  }

  /**
   * Approve a B2B draft order (F-03): draft → approved.
   */
  async approveB2bOrder(input: {
    orderId: string;
    approverCustomerId: string;
  }): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id: input.orderId } });
    if (!row) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (!row.companyId) {
      throw new BadRequestException(
        `Order ${input.orderId} is not a B2B company order`,
      );
    }
    if (row.status !== 'draft') {
      throw new BadRequestException(
        `Order ${input.orderId} must be draft to approve (status=${row.status})`,
      );
    }
    await this.companies.assertCanApprove(
      row.companyId,
      input.approverCustomerId,
    );
    return this.transitionStatus(row.id, 'approved', {
      note: `Approved by customer ${input.approverCustomerId}`,
    });
  }

  /**
   * Confirm an approved B2B order with payment (F-03): approved → confirmed.
   */
  async confirmB2bOrder(input: {
    orderId: string;
    paymentMethod?: string;
  }): Promise<OrderType> {
    const paymentMethod = (input.paymentMethod ?? 'manual').trim();
    if (!paymentMethod) {
      throw new BadRequestException('paymentMethod is required');
    }
    const { providerCode, captureImmediately, methodLabel } =
      resolvePaymentPath(paymentMethod);

    const row = await this.orders.findOne({ where: { id: input.orderId } });
    if (!row) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (!row.companyId) {
      throw new BadRequestException(
        `Order ${input.orderId} is not a B2B company order`,
      );
    }
    if (row.status !== 'approved') {
      throw new BadRequestException(
        `Order ${input.orderId} must be approved before confirm (status=${row.status})`,
      );
    }

    const totalMinor = BigInt(String(row.totalMinor));
    if (methodLabel === 'zero' && totalMinor !== 0n) {
      throw new BadRequestException(
        `Zero payment requires a zero total (got ${totalMinor.toString()})`,
      );
    }

    const giftCode = row.giftCardCode?.trim();
    const giftCardMinor = BigInt(String(row.giftCardMinor ?? '0'));
    if (giftCode && giftCardMinor > 0n) {
      try {
        await this.giftCards.redeem({
          code: giftCode,
          amountMinor: giftCardMinor.toString(),
          orderId: row.id,
          note: `Redeemed on B2B order ${row.id}`,
        });
      } catch (err) {
        await this.transitionStatus(row.id, 'cancelled', {
          note: 'Gift card redeem failed during confirmB2bOrder',
        });
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Gift card redeem failed',
        );
      }
    }

    const loyaltyPoints = row.loyaltyPointsRedeemed ?? 0;
    if (loyaltyPoints > 0 && row.customerId) {
      try {
        await this.loyalty.redeem({
          customerId: row.customerId,
          points: loyaltyPoints,
          orderId: row.id,
          note: `Redeemed on B2B order ${row.id}`,
        });
      } catch (err) {
        await this.transitionStatus(row.id, 'cancelled', {
          note: 'Loyalty redeem failed during confirmB2bOrder',
        });
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new BadRequestException(
          err instanceof Error ? err.message : 'Loyalty redeem failed',
        );
      }
    }

    if (!this.payments.get(providerCode)) {
      throw new BadRequestException(
        `Payment provider "${providerCode}" is not registered or inactive`,
      );
    }

    let payment;
    try {
      payment = await this.payments.authorize({
        providerCode,
        orderId: row.id,
        amount: {
          amountMinor: totalMinor.toString(),
          currencyCode: row.currencyCode,
        },
        idempotencyKey: `confirm-b2b-order:${row.id}`,
        metadata: {
          companyId: row.companyId,
          paymentMethod: methodLabel,
        },
      });

      if (payment.status === 'failed') {
        throw new BadRequestException(
          payment.errorMessage ?? 'Payment authorization failed',
        );
      }

      if (captureImmediately && payment.status !== 'captured') {
        payment = await this.payments.capture({
          paymentId: payment.id,
          idempotencyKey: `confirm-b2b-order-capture:${row.id}`,
        });
        if (payment.status === 'failed') {
          throw new BadRequestException(
            payment.errorMessage ?? 'Payment capture failed',
          );
        }
      }
    } catch (err) {
      await this.transitionStatus(row.id, 'cancelled', {
        note: `Payment failed during confirmB2bOrder (${methodLabel})`,
      });
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Payment processing failed',
      );
    }

    await this.publishTimeline({
      orderId: row.id,
      type: 'payment_recorded',
      fromStatus: 'approved',
      toStatus: 'approved',
      paymentMethod: methodLabel,
      note: `Payment ${payment.id} ${payment.status} via ${providerCode}`,
    });

    return this.transitionStatus(row.id, 'confirmed', {
      note: `B2B confirmed after ${methodLabel} payment (${payment.status})`,
    });
  }

  /**
   * Apply an allowed status transition and publish timeline events (D-05).
   */
  async updateStatus(input: UpdateOrderStatusInput): Promise<OrderType> {
    if (!isOrderStatus(input.status)) {
      throw new BadRequestException(
        `Invalid order status "${input.status}"`,
      );
    }
    return this.transitionStatus(input.id, input.status);
  }

  private async transitionStatus(
    orderId: string,
    toStatus: OrderStatus,
    opts?: { note?: string },
  ): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id: orderId } });
    if (!row) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const fromStatus = row.status;
    if (fromStatus === toStatus) {
      return this.hydrate(row);
    }

    if (!canTransitionOrderStatus(fromStatus, toStatus)) {
      throw new BadRequestException(
        `Invalid order status transition: ${fromStatus} → ${toStatus}`,
      );
    }

    row.status = toStatus;
    const saved = await this.orders.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.OrderStatusChanged,
      aggregateType: 'order',
      aggregateId: saved.id,
      data: {
        orderId: saved.id,
        fromStatus,
        toStatus,
      },
    });

    if (toStatus === 'cancelled') {
      await this.eventBus.publish({
        eventName: CoreEventName.OrderCancelled,
        aggregateType: 'order',
        aggregateId: saved.id,
        data: {
          orderId: saved.id,
          fromStatus,
        },
      });
    }

    await this.publishTimeline({
      orderId: saved.id,
      type: 'status_changed',
      fromStatus,
      toStatus,
      paymentMethod: null,
      note: opts?.note ?? null,
    });

    return this.hydrate(saved);
  }

  private async publishTimeline(data: {
    orderId: string;
    type: 'created' | 'status_changed' | 'payment_recorded';
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    paymentMethod: string | null;
    note: string | null;
  }): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.OrderTimeline,
      aggregateType: 'order',
      aggregateId: data.orderId,
      data,
    });
  }

  private async hydrate(row: OrderEntity): Promise<OrderType> {
    const lines = await this.lines.find({
      where: { orderId: row.id },
      order: { createdAt: 'ASC' },
    });
    return toOrderType(row, lines);
  }
}
