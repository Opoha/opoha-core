import type { CouponEntity, CouponKind } from './entities/coupon.entity';
import type { DiscountRuleEntity, DiscountRuleKind } from './entities/discount-rule.entity';
import type {
  PromotionApplication,
  PromotionApplyInput,
  PromotionApplyResult,
} from './promotion-rule';

/** Shared fields for coupon / discount-rule evaluation. */
export type DiscountableRule = {
  code: string;
  name: string;
  kind: CouponKind | DiscountRuleKind;
  valueBps: number | null;
  amountMinor: string | null;
  currencyCode: string | null;
  minSubtotalMinor: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type ComputedDiscount = {
  discountMinor: bigint;
  freeShipping: boolean;
  application: PromotionApplication | null;
};

/**
 * Whether a coupon/rule is active at `now` (isActive + optional window).
 */
export function isWithinSchedule(
  rule: Pick<DiscountableRule, 'isActive' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): boolean {
  if (!rule.isActive) {
    return false;
  }
  if (rule.startsAt && rule.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (rule.endsAt && rule.endsAt.getTime() < now.getTime()) {
    return false;
  }
  return true;
}

/**
 * Whether merchandise subtotal meets the optional minimum.
 */
export function meetsMinSubtotal(
  rule: Pick<DiscountableRule, 'minSubtotalMinor'>,
  subtotalMinor: bigint,
): boolean {
  if (rule.minSubtotalMinor == null || rule.minSubtotalMinor === '') {
    return true;
  }
  let min: bigint;
  try {
    min = BigInt(String(rule.minSubtotalMinor));
  } catch {
    return false;
  }
  return subtotalMinor >= min;
}

/**
 * Compute a single rule/coupon discount against merchandise subtotal.
 * BXGY is deferred (returns zero) until D-05 follow-on.
 */
export function computeRuleDiscount(
  rule: DiscountableRule,
  input: Pick<PromotionApplyInput, 'currencyCode' | 'subtotalMinor'>,
  applicationKind: PromotionApplication['kind'],
): ComputedDiscount {
  const subtotal = BigInt(String(input.subtotalMinor ?? '0'));
  const empty: ComputedDiscount = {
    discountMinor: 0n,
    freeShipping: false,
    application: null,
  };

  if (!isWithinSchedule(rule) || !meetsMinSubtotal(rule, subtotal)) {
    return empty;
  }

  const kind = rule.kind;
  if (kind === 'bxgy') {
    return empty;
  }

  if (kind === 'free_shipping') {
    return {
      discountMinor: 0n,
      freeShipping: true,
      application: {
        code: rule.code,
        kind: 'free_shipping',
        discountMinor: '0',
        freeShipping: true,
        label: rule.name,
      },
    };
  }

  let discount = 0n;

  if (kind === 'percentage' || (kind === 'automatic' && rule.valueBps != null)) {
    const bps = rule.valueBps ?? 0;
    if (bps <= 0) {
      return empty;
    }
    discount = (subtotal * BigInt(bps)) / 10000n;
  } else if (kind === 'fixed_amount' || (kind === 'automatic' && rule.amountMinor != null)) {
    if (rule.currencyCode && rule.currencyCode.toUpperCase() !== input.currencyCode.toUpperCase()) {
      return empty;
    }
    try {
      discount = BigInt(String(rule.amountMinor ?? '0'));
    } catch {
      return empty;
    }
  } else {
    return empty;
  }

  if (discount < 0n) {
    discount = 0n;
  }
  if (discount > subtotal) {
    discount = subtotal;
  }
  if (discount === 0n) {
    return empty;
  }

  return {
    discountMinor: discount,
    freeShipping: false,
    application: {
      code: rule.code,
      kind: applicationKind,
      discountMinor: discount.toString(),
      label: rule.name,
    },
  };
}

export function couponToDiscountable(coupon: CouponEntity): DiscountableRule {
  return {
    code: coupon.code,
    name: coupon.name,
    kind: coupon.kind,
    valueBps: coupon.valueBps,
    amountMinor: coupon.amountMinor,
    currencyCode: coupon.currencyCode,
    minSubtotalMinor: coupon.minSubtotalMinor,
    startsAt: coupon.startsAt,
    endsAt: coupon.endsAt,
    isActive: coupon.isActive,
  };
}

export function discountRuleToDiscountable(rule: DiscountRuleEntity): DiscountableRule {
  return {
    code: rule.code,
    name: rule.name,
    kind: rule.kind,
    valueBps: rule.valueBps,
    amountMinor: rule.amountMinor,
    currencyCode: rule.currencyCode,
    minSubtotalMinor: rule.minSubtotalMinor,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    isActive: rule.isActive,
  };
}

/**
 * Merge coupon + automatic discount applications; cap total at subtotal.
 */
export function mergePromotionApplications(
  currencyCode: string,
  subtotalMinor: bigint,
  parts: ComputedDiscount[],
): PromotionApplyResult {
  const applications: PromotionApplication[] = [];
  let discount = 0n;
  let freeShipping = false;

  for (const part of parts) {
    if (part.freeShipping) {
      freeShipping = true;
    }
    if (part.application) {
      applications.push(part.application);
      discount += part.discountMinor;
    } else if (part.discountMinor > 0n) {
      discount += part.discountMinor;
    }
  }

  const capped = discount > subtotalMinor ? subtotalMinor : discount;

  return {
    currencyCode,
    discountMinor: capped.toString(),
    applications,
    freeShipping,
  };
}

/**
 * Select automatic rules to apply: all qualifying stackable rules, plus the
 * single highest-priority non-stackable when no stackables qualify (or when
 * the non-stackable has higher priority than any stackable — exclusive win).
 *
 * Policy (D-03): if any qualifying non-stackable has priority >= every
 * qualifying stackable, apply only that non-stackable; otherwise apply all
 * qualifying stackables (ignore lower-priority non-stackables).
 */
export function selectAutomaticRules(rules: DiscountRuleEntity[]): DiscountRuleEntity[] {
  const qualifying = rules
    .filter((r) => isWithinSchedule(discountRuleToDiscountable(r)))
    .sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code));

  if (qualifying.length === 0) {
    return [];
  }

  const stackables = qualifying.filter((r) => r.stackable);
  const nonStackable = qualifying.find((r) => !r.stackable);

  if (!nonStackable) {
    return stackables;
  }

  const topStackablePriority =
    stackables.length > 0 ? stackables[0]!.priority : Number.NEGATIVE_INFINITY;

  if (nonStackable.priority >= topStackablePriority) {
    return [nonStackable];
  }

  return stackables;
}
