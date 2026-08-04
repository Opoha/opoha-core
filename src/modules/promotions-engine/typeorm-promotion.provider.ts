import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SegmentsService, type SegmentMembershipContext } from '../segments/public';
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
import {
  extractSegmentRestriction,
  membershipContextFromApplyInput,
  type SegmentRestriction,
} from './segment-eligibility';

/**
 * Core TypeORM promotion provider.
 * Reads Coupon / DiscountRule entities and applies coupon + automatic discounts
 * into checkout totals. Segment restrictions live on coupon.metadata /
 * discount_rules.conditions (`segmentIds` / `segmentCodes`).
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
    @Optional() private readonly segments?: SegmentsService,
  ) {}

  async apply(input: PromotionApplyInput): Promise<PromotionApplyResult> {
    const subtotal = BigInt(String(input.subtotalMinor ?? '0'));
    const parts = [];
    const membership = membershipContextFromApplyInput(input);

    if (input.couponCode?.trim()) {
      parts.push(await this.applyCoupon(input.couponCode.trim(), input, subtotal, membership));
    }

    const autoRules = await this.loadActiveAutomaticRules();
    const selected = selectAutomaticRules(autoRules).filter((rule) =>
      meetsMinSubtotal(discountRuleToDiscountable(rule), subtotal),
    );

    for (const rule of selected) {
      const restriction = extractSegmentRestriction(rule.conditions);
      const eligible = await this.isSegmentEligible(restriction, membership);
      if (!eligible) {
        continue;
      }
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
    membership: SegmentMembershipContext | null,
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

    const restriction = extractSegmentRestriction(coupon.metadata);
    const eligible = await this.isSegmentEligible(restriction, membership);
    if (!eligible) {
      throw new BadRequestException(
        `Coupon "${rawCode}" is not available for this customer segment`,
      );
    }

    const computed = computeRuleDiscount(
      couponToDiscountable(coupon),
      input,
      coupon.kind === 'free_shipping' ? 'free_shipping' : 'coupon',
    );

    if (!computed.application && !computed.freeShipping && computed.discountMinor === 0n) {
      // Distinguish schedule / min / currency mismatches from unknown codes.
      if (!coupon.isActive) {
        throw new BadRequestException(`Coupon "${rawCode}" is not active`);
      }
      if (
        coupon.minSubtotalMinor != null &&
        !meetsMinSubtotal(couponToDiscountable(coupon), subtotal)
      ) {
        throw new BadRequestException(`Coupon "${rawCode}" requires a higher merchandise subtotal`);
      }
      throw new BadRequestException(`Coupon "${rawCode}" cannot be applied`);
    }

    return computed;
  }

  /**
   * Returns true when there is no restriction, or the customer matches any
   * listed segment. Fail closed when a restriction is set but membership
   * context or SegmentsService is missing.
   */
  private async isSegmentEligible(
    restriction: SegmentRestriction | null,
    membership: SegmentMembershipContext | null,
  ): Promise<boolean> {
    if (!restriction) {
      return true;
    }
    if (!membership || !this.segments) {
      return false;
    }

    for (const id of restriction.segmentIds) {
      try {
        if (await this.segments.customerMatchesSegment(id, membership)) {
          return true;
        }
      } catch {
        // Unknown / inactive segment id — try remaining entries.
      }
    }

    for (const code of restriction.segmentCodes) {
      try {
        const segment = await this.segments.findByCode(code);
        if (segment.isActive && this.segments.evaluateRules(segment.rules, membership)) {
          return true;
        }
      } catch {
        // Unknown code — try remaining.
      }
    }

    return false;
  }

  private async loadActiveAutomaticRules(): Promise<DiscountRuleEntity[]> {
    return this.discountRules.find({
      where: { isActive: true },
      order: { priority: 'DESC', code: 'ASC' },
    });
  }
}
