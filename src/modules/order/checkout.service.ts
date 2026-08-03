import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryService } from '../inventory/public';
import { PromotionsEngine } from '../promotions-engine/public';
import { TaxEngine } from '../tax-engine/public';
import {
  buildPromotionApplyInput,
  buildTaxCalculateInput,
  lineSubtotalMinor,
  totalsWithTax,
} from './checkout-tax';
import { CartLineEntity } from './entities/cart-line.entity';
import { CartService } from './cart.service';
import type { CheckoutPreviewType } from './order.types';

/**
 * Checkout prepare — reserve stock for cart lines and compute totals.
 * Shipping from cart selection (B-03); tax via TaxEngine (C-03);
 * promotions via PromotionsEngine (D-01).
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
  ) {}

  async prepare(cartId: string): Promise<CheckoutPreviewType> {
    const { cart, lines } = await this.carts.getEntityWithLines(cartId);

    if (cart.status === 'converted' || cart.status === 'abandoned') {
      throw new BadRequestException(
        `Cart ${cartId} is ${cart.status} and cannot be checked out`,
      );
    }
    if (lines.length === 0) {
      throw new BadRequestException(`Cart ${cartId} has no lines`);
    }

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
    await this.carts.setStatus(cartId, 'locked');

    const refreshed = await this.carts.findById(cartId);
    const totals = totalsWithTax({
      currencyCode: cart.currencyCode,
      subtotalMinor: lineSubtotalMinor(lines),
      shippingMinor: BigInt(String(cart.shippingMinor ?? '0')),
      tax: taxResult,
      discountMinor: BigInt(String(promoResult.discountMinor || '0')),
      freeShipping: promoResult.freeShipping === true,
    });

    return {
      cartId,
      cart: refreshed,
      totals,
      reservationIds,
    };
  }
}
