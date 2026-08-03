import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  computeRuleDiscount,
  couponToDiscountable,
  discountRuleToDiscountable,
  meetsMinSubtotal,
  mergePromotionApplications,
  selectAutomaticRules,
} from './apply-discount';
import { CouponEntity } from './entities/coupon.entity';
import { DiscountRuleEntity } from './entities/discount-rule.entity';
import type {
  PromotionApplyInput,
  PromotionApplyResult,
  PromotionRuleProvider,
} from './promotion-rule';

/**
 * Core TypeORM promotion provider (D-03).
 * Reads Coupon / DiscountRule entities and applies coupon + automatic discounts
 * into checkout totals. Plugins (D-04) may register additional providers.
 */
@Injectable()
export class TypeOrmPromotionProvider implements PromotionRuleProvider {
  readonly code = 'typeorm';
  readonly displayName = 'Core TypeORM promotions';

  constructor(
    @InjectRepository(CouponEntity)
    private readonly coupons: Repository<CouponEntity>,
    @InjectRepository(DiscountRuleEntity)
    private readonly discountRules: Repository<DiscountRuleEntity>,
  ) {}

  async apply(input: PromotionApplyInput): Promise<PromotionApplyResult> {
    const subtotal = BigInt(String(input.subtotalMinor ?? '0'));
    const parts = [];

    if (input.couponCode?.trim()) {
      parts.push(await this.applyCoupon(input.couponCode.trim(), input, subtotal));
    }

    const autoRules = await this.loadActiveAutomaticRules();
    const selected = selectAutomaticRules(autoRules).filter((rule) =>
      meetsMinSubtotal(discountRuleToDiscountable(rule), subtotal),
    );

    for (const rule of selected) {
      parts.push(
        computeRuleDiscount(
          discountRuleToDiscountable(rule),
          input,
          rule.kind === 'free_shipping' ? 'free_shipping' : 'automatic',
        ),
      );
    }

    return mergePromotionApplications(input.currencyCode, subtotal, parts);
  }

  private async applyCoupon(
    rawCode: string,
    input: PromotionApplyInput,
    subtotal: bigint,
  ) {
    const code = rawCode.toUpperCase();
    const coupon = await this.coupons.findOne({
      where: { code },
    });

    if (!coupon) {
      throw new BadRequestException(`Coupon "${rawCode}" is not valid`);
    }

    if (coupon.maxUses != null && coupon.usageCount >= coupon.maxUses) {
      throw new BadRequestException(`Coupon "${rawCode}" has reached its usage limit`);
    }

    const computed = computeRuleDiscount(
      couponToDiscountable(coupon),
      input,
      coupon.kind === 'free_shipping' ? 'free_shipping' : 'coupon',
    );

    if (
      !computed.application &&
      !computed.freeShipping &&
      computed.discountMinor === 0n
    ) {
      // Distinguish schedule / min / currency mismatches from unknown codes.
      if (!coupon.isActive) {
        throw new BadRequestException(`Coupon "${rawCode}" is not active`);
      }
      if (
        coupon.minSubtotalMinor != null &&
        !meetsMinSubtotal(couponToDiscountable(coupon), subtotal)
      ) {
        throw new BadRequestException(
          `Coupon "${rawCode}" requires a higher merchandise subtotal`,
        );
      }
      throw new BadRequestException(`Coupon "${rawCode}" cannot be applied`);
    }

    return computed;
  }

  private async loadActiveAutomaticRules(): Promise<DiscountRuleEntity[]> {
    return this.discountRules.find({
      where: { isActive: true },
      order: { priority: 'DESC', code: 'ASC' },
    });
  }
}
