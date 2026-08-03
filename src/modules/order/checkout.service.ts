import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryService } from '../inventory/public';
import { CartLineEntity } from './entities/cart-line.entity';
import { CartService } from './cart.service';
import type { CheckoutPreviewType, CheckoutTotalsType } from './order.types';

function lineTotalMinor(unitPriceMinor: string, quantity: number): bigint {
  return BigInt(unitPriceMinor) * BigInt(quantity);
}

function toTotals(
  currencyCode: string,
  lines: CartLineEntity[],
): CheckoutTotalsType {
  let subtotal = 0n;
  for (const line of lines) {
    subtotal += lineTotalMinor(String(line.unitPriceMinor), line.quantity);
  }
  return {
    currencyCode,
    subtotalMinor: subtotal.toString(),
    taxMinor: '0',
    shippingMinor: '0',
    totalMinor: subtotal.toString(),
  };
}

/**
 * Checkout prepare — reserve stock for cart lines and compute totals stub (no tax).
 * Place-order (D-04) consumes this preview.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    @InjectRepository(CartLineEntity)
    private readonly lines: Repository<CartLineEntity>,
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
    await this.carts.setStatus(cartId, 'locked');

    const refreshed = await this.carts.findById(cartId);
    const totals = toTotals(cart.currencyCode, lines);

    return {
      cartId,
      cart: refreshed,
      totals,
      reservationIds,
    };
  }
}
