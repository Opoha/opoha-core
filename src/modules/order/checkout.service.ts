import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { GiftCardService } from '../gift-cards/public';
import { InventoryService } from '../inventory/public';
import { LoyaltyService } from '../loyalty/public';
import { PromotionsEngine } from '../promotions-engine/public';
import type { StoreContextRef } from '../stores/public';
import { StoreService } from '../stores/public';
import { TaxEngine } from '../tax-engine/public';
import {
  applyGiftCardToTotals,
  applyLoyaltyToTotals,
  buildPromotionApplyInput,
  buildTaxCalculateInput,
  lineSubtotalMinor,
  totalsWithTax,
} from './checkout-tax';
import { CartLineEntity } from './entities/cart-line.entity';
import { CartService } from './cart.service';
import type { CheckoutPreviewType } from './order.types';
import {
  assertStoreContextMatchesCart,
  requireActiveStore,
  resolveContextStoreId,
} from './store-scope';

/**
 * Checkout prepare — reserve stock for cart lines and compute totals.
 * Shipping from cart selection (B-03); tax via TaxEngine (C-03);
 * promotions via PromotionsEngine TypeORM provider (D-01 / D-03);
 * gift cards via GiftCardService quote (Phase 4 C-02);
 * loyalty via LoyaltyService quote (Phase 4 C-03).
 * Publishes CheckoutPrepared for analytics sinks (Phase 4 F-02).
 * Phase 5 B-02: validates cart storeId against request store context.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    @InjectRepository(CartLineEntity)
    private readonly lines: Repository<CartLineEntity>,
    private readonly tax: TaxEngine,
    private readonly promotions: PromotionsEngine,
    private readonly giftCards: GiftCardService,
    private readonly loyalty: LoyaltyService,
    private readonly eventBus: EventBusService,
    private readonly stores: StoreService,
  ) {}

  async prepare(
    cartId: string,
    context?: StoreContextRef | null,
  ): Promise<CheckoutPreviewType> {
    const { cart, lines } = await this.carts.getEntityWithLines(cartId);

    if (cart.status === 'converted' || cart.status === 'abandoned') {
      throw new BadRequestException(
        `Cart ${cartId} is ${cart.status} and cannot be checked out`,
      );
    }
    if (lines.length === 0) {
      throw new BadRequestException(`Cart ${cartId} has no lines`);
    }
    if (!cart.storeId) {
      throw new BadRequestException(
        `Cart ${cartId} has no storeId; recreate the cart with a store context`,
      );
    }

    await requireActiveStore(this.stores, cart.storeId);
    const contextStoreId = await resolveContextStoreId(this.stores, context);
    assertStoreContextMatchesCart({
      cartStoreId: cart.storeId,
      contextStoreId,
    });

    // Release any prior active reservations on lines (re-prepare).
    for (const line of lines) {
      if (line.reservationId) {
        try {
          await this.inventory.release(line.reservationId);
        } catch {
          // Reservation may already be released; clear pointer and continue.
        }
        line.reservationId = null;
        await this.lines.save(line);
      }
    }

    const reservationIds: string[] = [];
    const attachments: Array<{ lineId: string; reservationId: string }> = [];

    try {
      for (const line of lines) {
        const reservation = await this.inventory.reserve({
          variantId: line.variantId,
          quantity: line.quantity,
          reference: `cart_line:${line.id}`,
        });
        reservationIds.push(reservation.id);
        attachments.push({
          lineId: line.id,
          reservationId: reservation.id,
        });
      }
    } catch (error) {
      // Roll back reservations created in this attempt.
      for (const id of reservationIds) {
        try {
          await this.inventory.release(id);
        } catch {
          // best-effort
        }
      }
      throw error;
    }

    await this.carts.attachReservations(attachments);

    const promoInput = buildPromotionApplyInput(cart, lines);
    const promoResult = await this.promotions.applyOrZero(promoInput);

    const taxInput = buildTaxCalculateInput(cart, lines);
    const taxResult = await this.tax.calculateOrZero(
      taxInput,
      cart.taxProviderCode ?? undefined,
    );

    await this.carts.persistTaxResult(cartId, taxResult.taxMinor);
    await this.carts.persistDiscountResult(cartId, promoResult.discountMinor);

    let totals = totalsWithTax({
      currencyCode: cart.currencyCode,
      subtotalMinor: lineSubtotalMinor(lines),
      shippingMinor: BigInt(String(cart.shippingMinor ?? '0')),
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
        maxAmountMinor: totals.totalMinor,
      });
      giftCardMinor = BigInt(String(quote.appliedMinor || '0'));
      totals = applyGiftCardToTotals(totals, giftCardMinor);
    }

    await this.carts.persistGiftCardResult(cartId, giftCardMinor.toString());

    let loyaltyMinor = 0n;
    const loyaltyPoints = cart.loyaltyPointsToRedeem ?? 0;
    if (loyaltyPoints > 0 && cart.customerId) {
      const quote = await this.loyalty.quoteRedeem({
        customerId: cart.customerId,
        points: loyaltyPoints,
        maxAmountMinor: totals.totalMinor,
      });
      loyaltyMinor = BigInt(String(quote.appliedMinor || '0'));
      totals = applyLoyaltyToTotals(totals, loyaltyMinor);
    }

    await this.carts.persistLoyaltyResult(cartId, loyaltyMinor.toString());
    await this.carts.setStatus(cartId, 'locked');

    const refreshed = await this.carts.findById(cartId);

    await this.eventBus.publish({
      eventName: CoreEventName.CheckoutPrepared,
      aggregateType: 'cart',
      aggregateId: cartId,
      data: {
        cartId,
        storeId: cart.storeId,
        customerId: cart.customerId,
        currencyCode: totals.currencyCode,
        subtotalMinor: totals.subtotalMinor,
        shippingMinor: totals.shippingMinor,
        taxMinor: totals.taxMinor,
        discountMinor: totals.discountMinor,
        totalMinor: totals.totalMinor,
        lineCount: lines.length,
      },
    });

    return {
      cartId,
      cart: refreshed,
      totals,
      reservationIds,
    };
  }
}
