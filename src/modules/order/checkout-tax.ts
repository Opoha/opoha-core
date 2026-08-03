import { DEFAULT_LOCALIZATION_SETTINGS } from '../localization/public';
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
 * Merge merchandise + shipping + tax into checkout totals.
 * - exclusive: tax is added on top of net subtotal
 * - inclusive: tax is embedded in subtotal; do not add again to total
 */
export function totalsWithTax(args: {
  currencyCode: string;
  subtotalMinor: bigint;
  shippingMinor: bigint;
  tax: Pick<TaxCalculateResult, 'taxMinor' | 'pricingMode'>;
}): CheckoutTotalsType {
  const taxMinor = BigInt(String(args.tax.taxMinor || '0'));
  const total =
    args.tax.pricingMode === 'inclusive'
      ? args.subtotalMinor + args.shippingMinor
      : args.subtotalMinor + taxMinor + args.shippingMinor;

  return {
    currencyCode: args.currencyCode,
    subtotalMinor: args.subtotalMinor.toString(),
    taxMinor: taxMinor.toString(),
    shippingMinor: args.shippingMinor.toString(),
    totalMinor: total.toString(),
  };
}

export function lineSubtotalMinor(lines: CartLineEntity[]): bigint {
  let subtotal = 0n;
  for (const line of lines) {
    subtotal += BigInt(String(line.unitPriceMinor)) * BigInt(line.quantity);
  }
  return subtotal;
}
