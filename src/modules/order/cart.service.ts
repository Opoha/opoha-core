import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { ProductVariantEntity } from '../catalog/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { ShippingEngine } from '../shipping-engine/public';
import type { ShippingQuoteInput } from '../shipping-engine/public';
import { CartLineEntity } from './entities/cart-line.entity';
import { CartEntity } from './entities/cart.entity';
import type {
  AddCartLineInput,
  CartLineType,
  CartType,
  CreateCartInput,
  SelectCartShippingInput,
  SetCartTaxContextInput,
  UpdateCartLineInput,
} from './order.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toLineType(row: CartLineEntity): CartLineType {
  return {
    id: row.id,
    cartId: row.cartId,
    variantId: row.variantId,
    quantity: row.quantity,
    unitPriceMinor: String(row.unitPriceMinor),
    reservationId: row.reservationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCartType(row: CartEntity, lines: CartLineEntity[]): CartType {
  return {
    id: row.id,
    customerId: row.customerId,
    status: row.status,
    currencyCode: row.currencyCode,
    shippingMethodCode: row.shippingMethodCode ?? null,
    shippingRateCode: row.shippingRateCode ?? null,
    shippingMinor: String(row.shippingMinor ?? '0'),
    taxPricingMode: row.taxPricingMode ?? 'exclusive',
    taxCountryCode: row.taxCountryCode ?? null,
    taxPostalCode: row.taxPostalCode ?? null,
    taxProvince: row.taxProvince ?? null,
    taxProviderCode: row.taxProviderCode ?? null,
    taxMinor: String(row.taxMinor ?? '0'),
    lines: lines.map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly carts: Repository<CartEntity>,
    @InjectRepository(CartLineEntity)
    private readonly lines: Repository<CartLineEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    private readonly eventBus: EventBusService,
    private readonly shipping: ShippingEngine,
  ) {}

  async findAll(): Promise<CartType[]> {
    const rows = await this.carts.find({ order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<CartType> {
    const row = await this.carts.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Cart ${id} not found`);
    }
    return this.hydrate(row);
  }

  /** Internal: load entity + lines (for checkout). */
  async getEntityWithLines(id: string): Promise<{
    cart: CartEntity;
    lines: CartLineEntity[];
  }> {
    const cart = await this.carts.findOne({ where: { id } });
    if (!cart) {
      throw new NotFoundException(`Cart ${id} not found`);
    }
    const lines = await this.lines.find({
      where: { cartId: id },
      order: { createdAt: 'ASC' },
    });
    return { cart, lines };
  }

  async create(input: CreateCartInput): Promise<CartType> {
    const currency =
      input.currencyCode?.trim().toUpperCase() || 'USD';
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException(
        'currencyCode must be a 3-letter ISO code',
      );
    }

    const cart = this.carts.create({
      customerId: input.customerId ?? null,
      status: 'open',
      currencyCode: currency,
      shippingMethodCode: null,
      shippingRateCode: null,
      shippingMinor: '0',
      taxPricingMode: 'exclusive',
      taxCountryCode: null,
      taxPostalCode: null,
      taxProvince: null,
      taxProviderCode: null,
      taxMinor: '0',
    });

    try {
      const saved = await this.carts.save(cart);
      await this.eventBus.publish({
        eventName: CoreEventName.CartCreated,
        aggregateType: 'cart',
        aggregateId: saved.id,
        data: {
          cartId: saved.id,
          customerId: saved.customerId,
          currencyCode: saved.currencyCode,
        },
      });
      return this.hydrate(saved);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Customer ${input.customerId} does not exist`,
        );
      }
      throw error;
    }
  }

  async addLine(input: AddCartLineInput): Promise<CartType> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const cart = await this.requireOpenCart(input.cartId);
    const variant = await this.variants.findOne({
      where: { id: input.variantId },
    });
    if (!variant) {
      throw new NotFoundException(
        `Product variant ${input.variantId} not found`,
      );
    }
    if (!variant.isActive) {
      throw new BadRequestException(
        `Product variant ${input.variantId} is not active`,
      );
    }

    const existing = await this.lines.findOne({
      where: { cartId: cart.id, variantId: input.variantId },
    });

    if (existing) {
      existing.quantity += input.quantity;
      existing.unitPriceMinor = String(variant.priceMinor);
      existing.reservationId = null;
      await this.lines.save(existing);
    } else {
      await this.lines.save(
        this.lines.create({
          cartId: cart.id,
          variantId: input.variantId,
          quantity: input.quantity,
          unitPriceMinor: String(variant.priceMinor),
          reservationId: null,
        }),
      );
    }

    return this.findById(cart.id);
  }

  async updateLine(input: UpdateCartLineInput): Promise<CartType> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const line = await this.lines.findOne({ where: { id: input.id } });
    if (!line) {
      throw new NotFoundException(`Cart line ${input.id} not found`);
    }
    await this.requireOpenCart(line.cartId);

    line.quantity = input.quantity;
    line.reservationId = null;
    await this.lines.save(line);
    return this.findById(line.cartId);
  }

  async removeLine(lineId: string): Promise<CartType> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) {
      throw new NotFoundException(`Cart line ${lineId} not found`);
    }
    const cartId = line.cartId;
    await this.requireOpenCart(cartId);
    await this.lines.delete(lineId);
    return this.findById(cartId);
  }

  /**
   * Validate a rate via ShippingEngine and persist selection on the cart (B-02).
   * Allowed on open or locked carts (checkout may select after prepare).
   */
  async selectShipping(input: SelectCartShippingInput): Promise<CartType> {
    const cart = await this.requireSelectableCart(input.cartId);
    const lines = await this.lines.find({
      where: { cartId: cart.id },
      order: { createdAt: 'ASC' },
    });
    if (lines.length === 0) {
      throw new BadRequestException(
        `Cart ${cart.id} has no lines; add items before selecting shipping`,
      );
    }

    let subtotal = 0n;
    const quoteItems = lines.map((line) => {
      const unit = String(line.unitPriceMinor);
      subtotal += BigInt(unit) * BigInt(line.quantity);
      return {
        variantId: line.variantId,
        quantity: line.quantity,
        unitAmountMinor: unit,
      };
    });

    const quoteInput: ShippingQuoteInput = {
      currencyCode: cart.currencyCode,
      destination: {
        countryCode: input.destinationCountryCode.trim().toUpperCase(),
        postalCode: input.destinationPostalCode?.trim(),
      },
      items: quoteItems,
      subtotalMinor: subtotal.toString(),
    };

    const rate = await this.shipping.findQuotedRate(
      quoteInput,
      input.methodCode,
      input.rateCode,
    );

    cart.shippingMethodCode = rate.methodCode;
    cart.shippingRateCode = rate.code;
    cart.shippingMinor = rate.amount.amountMinor;
    await this.carts.save(cart);

    return this.hydrate(cart);
  }

  /** Clear shipping selection (e.g. after cart line changes). */
  async clearShipping(cartId: string): Promise<CartType> {
    const cart = await this.requireSelectableCart(cartId);
    cart.shippingMethodCode = null;
    cart.shippingRateCode = null;
    cart.shippingMinor = '0';
    await this.carts.save(cart);
    return this.hydrate(cart);
  }

  /**
   * Persist tax pricing mode + jurisdiction on the cart (C-03).
   * Allowed on open or locked carts (checkout may set after prepare).
   */
  async setTaxContext(input: SetCartTaxContextInput): Promise<CartType> {
    const cart = await this.requireSelectableCart(input.cartId);
    const mode = (input.pricingMode ?? 'exclusive').trim().toLowerCase();
    if (mode !== 'inclusive' && mode !== 'exclusive') {
      throw new BadRequestException(
        'pricingMode must be "inclusive" or "exclusive"',
      );
    }
    const country = input.countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException(
        'countryCode must be a 2-letter ISO 3166-1 alpha-2 code',
      );
    }

    cart.taxPricingMode = mode;
    cart.taxCountryCode = country;
    cart.taxPostalCode = input.postalCode?.trim() || null;
    cart.taxProvince = input.province?.trim() || null;
    cart.taxProviderCode = input.providerCode?.trim() || null;
    // Invalidate prior tax snapshot until prepareCheckout recalculates.
    cart.taxMinor = '0';
    await this.carts.save(cart);
    return this.hydrate(cart);
  }

  /** Persist taxMinor after prepareCheckout calculation. */
  async persistTaxResult(cartId: string, taxMinor: string): Promise<void> {
    await this.carts.update({ id: cartId }, { taxMinor: String(taxMinor) });
  }

  /** Persist reservation ids on lines after checkout prepare. */
  async attachReservations(
    updates: Array<{ lineId: string; reservationId: string }>,
  ): Promise<void> {
    for (const update of updates) {
      await this.lines.update(
        { id: update.lineId },
        { reservationId: update.reservationId },
      );
    }
  }

  async setStatus(
    cartId: string,
    status: CartEntity['status'],
  ): Promise<void> {
    await this.carts.update({ id: cartId }, { status });
  }

  private async hydrate(row: CartEntity): Promise<CartType> {
    const lines = await this.lines.find({
      where: { cartId: row.id },
      order: { createdAt: 'ASC' },
    });
    return toCartType(row, lines);
  }

  private async requireSelectableCart(cartId: string): Promise<CartEntity> {
    const cart = await this.carts.findOne({ where: { id: cartId } });
    if (!cart) {
      throw new NotFoundException(`Cart ${cartId} not found`);
    }
    if (cart.status !== 'open' && cart.status !== 'locked') {
      throw new BadRequestException(
        `Cart ${cartId} is ${cart.status} and cannot select shipping`,
      );
    }
    return cart;
  }

  private async requireOpenCart(cartId: string): Promise<CartEntity> {
    const cart = await this.carts.findOne({ where: { id: cartId } });
    if (!cart) {
      throw new NotFoundException(`Cart ${cartId} not found`);
    }
    if (cart.status !== 'open' && cart.status !== 'locked') {
      throw new BadRequestException(
        `Cart ${cartId} is ${cart.status} and cannot be modified`,
      );
    }
    if (cart.status === 'locked') {
      throw new BadRequestException(
        `Cart ${cartId} is locked for checkout; recreate or unlock before editing`,
      );
    }
    return cart;
  }
}
