import { DEFAULT_LOCALIZATION_SETTINGS } from '../localization/public';
import type {
  PromotionApplyInput,
  PromotionApplyResult,
} from '../promotions-engine/public';
import type {
  TaxCalculateInput,
  TaxCalculateResult,
  TaxPricingMode,
} from '../tax-engine/public';
import type { CartLineEntity } from './entities/cart-line.entity';
import type { CartEntity } from './entities/cart.entity';
import type { CheckoutTotalsType } from './order.types';

const DEFAULT_TAX_CLASS = 'standard';

export function resolveCartPricingMode(cart: CartEntity): TaxPricingMode {
  const fromCart = cart.taxPricingMode;
  if (fromCart === 'inclusive' || fromCart === 'exclusive') {
    return fromCart;
  }
  const fromEnv = process.env.OPOHA_TAX_PRICING_MODE?.trim().toLowerCase();
  return fromEnv === 'inclusive' ? 'inclusive' : 'exclusive';
}

/**
 * Build TaxEngine input from a cart + lines (C-03).
 * Default tax class is `standard` until catalog carries taxClassCode (later).
 */
export function buildTaxCalculateInput(
  cart: CartEntity,
  lines: CartLineEntity[],
): TaxCalculateInput {
  let subtotal = 0n;
  const items = lines.map((line) => {
    const unit = String(line.unitPriceMinor);
    subtotal += BigInt(unit) * BigInt(line.quantity);
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitAmountMinor: unit,
      taxClassCode: DEFAULT_TAX_CLASS,
    };
  });

  const country =
    cart.taxCountryCode?.trim().toUpperCase() ||
    process.env.OPOHA_TAX_DEFAULT_COUNTRY?.trim().toUpperCase() ||
    DEFAULT_LOCALIZATION_SETTINGS.countryCode;

  return {
    currencyCode: cart.currencyCode,
    pricingMode: resolveCartPricingMode(cart),
    address: {
      countryCode: country,
      postalCode: cart.taxPostalCode?.trim() || undefined,
      province: cart.taxProvince?.trim() || undefined,
    },
    items,
    shippingMinor: String(cart.shippingMinor ?? '0'),
    subtotalMinor: subtotal.toString(),
  };
}

/**
 * Build PromotionsEngine input from a cart + lines (D-01).
 */
export function buildPromotionApplyInput(
  cart: CartEntity,
  lines: CartLineEntity[],
): PromotionApplyInput {
  let subtotal = 0n;
  const items = lines.map((line) => {
    const unit = String(line.unitPriceMinor);
    subtotal += BigInt(unit) * BigInt(line.quantity);
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitAmountMinor: unit,
    };
  });

  return {
    currencyCode: cart.currencyCode,
    items,
    subtotalMinor: subtotal.toString(),
    shippingMinor: String(cart.shippingMinor ?? '0'),
    couponCode: cart.couponCode?.trim() || undefined,
    customerId: cart.customerId ?? undefined,
  };
}

/**
 * Merge merchandise + shipping + tax + discount into checkout totals.
 * - exclusive: tax is added on top of net subtotal
 * - inclusive: tax is embedded in subtotal; do not add again to total
 * - discount is subtracted from merchandise (capped by caller / engine)
 * - freeShipping zeros shipping in the total
 */
export function totalsWithTax(args: {
  currencyCode: string;
  subtotalMinor: bigint;
  shippingMinor: bigint;
  tax: Pick<TaxCalculateResult, 'taxMinor' | 'pricingMode'>;
  discountMinor?: bigint;
  freeShipping?: boolean;
}): CheckoutTotalsType {
  const taxMinor = BigInt(String(args.tax.taxMinor || '0'));
  let discount = args.discountMinor ?? 0n;
  if (discount < 0n) {
    discount = 0n;
  }
  if (discount > args.subtotalMinor) {
    discount = args.subtotalMinor;
  }
  const shipping = args.freeShipping ? 0n : args.shippingMinor;
  const total =
    args.tax.pricingMode === 'inclusive'
      ? args.subtotalMinor - discount + shipping
      : args.subtotalMinor - discount + taxMinor + shipping;

  return {
    currencyCode: args.currencyCode,
    subtotalMinor: args.subtotalMinor.toString(),
    discountMinor: discount.toString(),
    giftCardMinor: '0',
    taxMinor: taxMinor.toString(),
    shippingMinor: shipping.toString(),
    totalMinor: (total < 0n ? 0n : total).toString(),
  };
}

/**
 * Apply a gift card amount to post-promo/tax totals (C-02).
 * Caps by remaining total; never increases total.
 */
export function applyGiftCardToTotals(
  totals: CheckoutTotalsType,
  giftCardMinor: bigint,
): CheckoutTotalsType {
  let gift = giftCardMinor;
  if (gift < 0n) {
    gift = 0n;
  }
  const priorTotal = BigInt(String(totals.totalMinor || '0'));
  if (gift > priorTotal) {
    gift = priorTotal;
  }
  const nextTotal = priorTotal - gift;
  return {
    ...totals,
    giftCardMinor: gift.toString(),
    totalMinor: nextTotal.toString(),
  };
}

export function lineSubtotalMinor(lines: CartLineEntity[]): bigint {
  let subtotal = 0n;
  for (const line of lines) {
    subtotal += BigInt(String(line.unitPriceMinor)) * BigInt(line.quantity);
  }
  return subtotal;
}

/** Persist helper shape for promotion apply results. */
export type CartPromotionSnapshot = Pick<
  PromotionApplyResult,
  'discountMinor' | 'freeShipping'
>;
