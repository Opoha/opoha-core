import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CurrencyConversionService } from '../currency/public';
import { ProductVariantEntity } from '../catalog/public';
import { isNonPhysicalFulfillment } from '../digital/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { InventoryService } from '../inventory/public';
import { GiftCardService } from '../gift-cards/public';
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
 * Shipping from cart selection; tax via TaxEngine;
 * promotions via PromotionsEngine TypeORM provider;
 * gift cards via GiftCardService quote;
 * loyalty via LoyaltyService quote.
 * Publishes CheckoutPrepared for analytics sinks.
 *: validates cart storeId against request store context.
 *: converts settlement totals to display currency via rates.
 *: reservations prefer warehouses linked to the cart store.
 *: digital/service SKUs skip inventory reservation and do not
 * require shipping selection.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    @InjectRepository(CartLineEntity)
    private readonly lines: Repository<CartLineEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    private readonly tax: TaxEngine,
    private readonly promotions: PromotionsEngine,
    private readonly giftCards: GiftCardService,
    private readonly loyalty: LoyaltyService,
    private readonly eventBus: EventBusService,
    private readonly stores: StoreService,
    private readonly currencyConversion: CurrencyConversionService,
  ) {}

  async prepare(
    cartId: string,
    context?: StoreContextRef | null,
    displayCurrencyCode?: string | null,
  ): Promise<CheckoutPreviewType> {
    const { cart, lines } = await this.carts.getEntityWithLines(cartId);

    if (cart.status === 'converted' || cart.status === 'abandoned') {
      throw new BadRequestException(`Cart ${cartId} is ${cart.status} and cannot be checked out`);
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

 // Re-apply B2B company price list overrides before tax/promo.
    await this.carts.applyCompanyPriceList(cartId);
    let pricedLines = lines;
    if (cart.companyId) {
      pricedLines = (await this.carts.getEntityWithLines(cartId)).lines;
    }

    // Release any prior active reservations on lines (re-prepare).
    for (const line of pricedLines) {
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

    const modeByVariant = await this.resolveFulfillmentModes(
      pricedLines.map((line) => line.variantId),
    );

    const reservationIds: string[] = [];
    const attachments: Array<{ lineId: string; reservationId: string }> = [];

    try {
      for (const line of pricedLines) {
        const mode = modeByVariant.get(line.variantId);
 // Digital / service: no stock reservation, no shipping requirement.
        if (isNonPhysicalFulfillment(mode)) {
          continue;
        }
        const reservation = await this.inventory.reserveForStore({
          variantId: line.variantId,
          storeId: cart.storeId,
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

    if (attachments.length > 0) {
      await this.carts.attachReservations(attachments);
    }

    const promoInput = buildPromotionApplyInput(cart, pricedLines);
    const promoResult = await this.promotions.applyOrZero(promoInput);

    const taxInput = buildTaxCalculateInput(cart, pricedLines);
    const taxResult = await this.tax.calculateOrZero(taxInput, cart.taxProviderCode ?? undefined);

    await this.carts.persistTaxResult(cartId, taxResult.taxMinor);
    await this.carts.persistDiscountResult(cartId, promoResult.discountMinor);

    let totals = totalsWithTax({
      currencyCode: cart.currencyCode,
      subtotalMinor: lineSubtotalMinor(pricedLines),
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
        lineCount: pricedLines.length,
      },
    });

    const displayTotals = await this.currencyConversion.convertTotals(
      cart.storeId,
      {
        currencyCode: totals.currencyCode,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        giftCardMinor: totals.giftCardMinor,
        loyaltyMinor: totals.loyaltyMinor,
        taxMinor: totals.taxMinor,
        shippingMinor: totals.shippingMinor,
        totalMinor: totals.totalMinor,
      },
      displayCurrencyCode,
    );

    return {
      cartId,
      cart: refreshed,
      totals,
      displayTotals,
      reservationIds,
    };
  }

  private async resolveFulfillmentModes(variantIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(variantIds.filter(Boolean))];
    const result = new Map<string, string>();
    if (unique.length === 0) {
      return result;
    }
    const variants = await this.variants.find({
      where: { id: In(unique) },
    });
    for (const variant of variants) {
      result.set(variant.id, variant.fulfillmentMode ?? 'physical');
    }
    for (const id of unique) {
      if (!result.has(id)) {
        result.set(id, 'physical');
      }
    }
    return result;
  }
}
