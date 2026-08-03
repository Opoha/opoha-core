import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { CouponsService } from './coupons.service';
import { DiscountRulesService } from './discount-rules.service';
import type { PromotionApplyResult } from './promotion-rule';
import { PromotionsEngine } from './promotions-engine.service';
import {
  ApplyPromotionsInput,
  CouponType,
  CreateCouponInput,
  CreateDiscountRuleInput,
  DiscountRuleType,
  PromotionApplyResultType,
  PromotionProviderType,
  UpdateCouponInput,
  UpdateDiscountRuleInput,
} from './promotion.types';

function parseMetadataJson(
  metadataJson: string | undefined,
): Record<string, unknown> | undefined {
  if (!metadataJson) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadataJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('metadataJson must encode a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException('metadataJson must be a valid JSON object string');
  }
}

function toApplyResultType(
  result: PromotionApplyResult,
): PromotionApplyResultType {
  return {
    currencyCode: result.currencyCode,
    discountMinor: result.discountMinor,
    freeShipping: result.freeShipping ?? false,
    applications: (result.applications ?? []).map((app) => ({
      code: app.code,
      kind: app.kind,
      discountMinor: app.discountMinor,
      freeShipping: app.freeShipping ?? null,
      label: app.label ?? null,
      lineIndex: app.lineIndex ?? null,
      metadataJson: app.metadata ? JSON.stringify(app.metadata) : null,
    })),
    metadataJson: result.metadata ? JSON.stringify(result.metadata) : null,
  };
}

@Resolver(() => CouponType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class PromotionsResolver {
  constructor(
    private readonly promotions: PromotionsEngine,
    private readonly coupons: CouponsService,
    private readonly discountRules: DiscountRulesService,
  ) {}

  @Query(() => [PromotionProviderType], {
    name: 'promotionProviders',
    description: 'List active registered promotion rule providers',
  })
  @RequirePermission('promotion:read')
  promotionProviders(): PromotionProviderType[] {
    return this.promotions.list().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
    }));
  }

  @Query(() => [CouponType], {
    name: 'coupons',
    description: 'List coupons',
  })
  @RequirePermission('promotion:read')
  couponsList(): Promise<CouponType[]> {
    return this.coupons.findAll();
  }

  @Query(() => CouponType, {
    name: 'coupon',
    description: 'Get coupon by id',
  })
  @RequirePermission('promotion:read')
  coupon(@Args('id', { type: () => ID }) id: string): Promise<CouponType> {
    return this.coupons.findById(id);
  }

  @Mutation(() => CouponType, {
    name: 'createCoupon',
    description: 'Create a coupon',
  })
  @RequirePermission('promotion:create')
  createCoupon(
    @Args('input', { type: () => CreateCouponInput }) input: CreateCouponInput,
  ): Promise<CouponType> {
    return this.coupons.create(input);
  }

  @Mutation(() => CouponType, {
    name: 'updateCoupon',
    description: 'Update a coupon',
  })
  @RequirePermission('promotion:update')
  updateCoupon(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateCouponInput }) input: UpdateCouponInput,
  ): Promise<CouponType> {
    return this.coupons.update(id, input);
  }

  @Mutation(() => CouponType, {
    name: 'deleteCoupon',
    description: 'Delete a coupon',
  })
  @RequirePermission('promotion:delete')
  deleteCoupon(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CouponType> {
    return this.coupons.remove(id);
  }

  @Query(() => [DiscountRuleType], {
    name: 'discountRules',
    description: 'List automatic discount rules',
  })
  @RequirePermission('promotion:read')
  discountRulesList(): Promise<DiscountRuleType[]> {
    return this.discountRules.findAll();
  }

  @Query(() => DiscountRuleType, {
    name: 'discountRule',
    description: 'Get discount rule by id',
  })
  @RequirePermission('promotion:read')
  discountRule(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DiscountRuleType> {
    return this.discountRules.findById(id);
  }

  @Mutation(() => DiscountRuleType, {
    name: 'createDiscountRule',
    description: 'Create an automatic discount rule',
  })
  @RequirePermission('promotion:create')
  createDiscountRule(
    @Args('input', { type: () => CreateDiscountRuleInput })
    input: CreateDiscountRuleInput,
  ): Promise<DiscountRuleType> {
    return this.discountRules.create(input);
  }

  @Mutation(() => DiscountRuleType, {
    name: 'updateDiscountRule',
    description: 'Update an automatic discount rule',
  })
  @RequirePermission('promotion:update')
  updateDiscountRule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateDiscountRuleInput })
    input: UpdateDiscountRuleInput,
  ): Promise<DiscountRuleType> {
    return this.discountRules.update(id, input);
  }

  @Mutation(() => DiscountRuleType, {
    name: 'deleteDiscountRule',
    description: 'Delete an automatic discount rule',
  })
  @RequirePermission('promotion:delete')
  deleteDiscountRule(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DiscountRuleType> {
    return this.discountRules.remove(id);
  }

  @Query(() => PromotionApplyResultType, {
    name: 'applyPromotions',
    description:
      'Admin preview: apply coupon + automatic discounts via PromotionsEngine',
  })
  @RequirePermission('promotion:read')
  async applyPromotions(
    @Args('input') input: ApplyPromotionsInput,
  ): Promise<PromotionApplyResultType> {
    const result = await this.promotions.apply(
      {
        currencyCode: input.currencyCode,
        items: input.items.map((item) => ({
          sku: item.sku,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitAmountMinor: item.unitAmountMinor,
        })),
        subtotalMinor: input.subtotalMinor,
        shippingMinor: input.shippingMinor,
        couponCode: input.couponCode,
        customerId: input.customerId,
        metadata: parseMetadataJson(input.metadataJson),
      },
      input.providerCode,
    );
    return toApplyResultType(result);
  }
}
