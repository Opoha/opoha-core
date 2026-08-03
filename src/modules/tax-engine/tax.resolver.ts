import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { TaxClassesService } from './tax-classes.service';
import { TaxEngine } from './tax-engine.service';
import { TaxRulesService } from './tax-rules.service';
import type { TaxCalculateResult } from './tax-provider';
import {
  CalculateTaxInput,
  CreateTaxClassInput,
  CreateTaxRuleInput,
  TaxCalculateResultType,
  TaxClassType,
  TaxProviderType,
  TaxRuleType,
  UpdateTaxClassInput,
  UpdateTaxRuleInput,
} from './tax.types';

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

function toCalculateResultType(
  result: TaxCalculateResult,
): TaxCalculateResultType {
  return {
    currencyCode: result.currencyCode,
    pricingMode: result.pricingMode,
    taxMinor: result.taxMinor,
    netMinor: result.netMinor ?? null,
    grossMinor: result.grossMinor ?? null,
    lines: result.lines.map((line) => ({
      lineIndex: line.lineIndex ?? null,
      taxClassCode: line.taxClassCode ?? null,
      rateBps: line.rateBps ?? null,
      taxAmountMinor: line.taxAmountMinor,
      taxableAmountMinor: line.taxableAmountMinor,
      name: line.name ?? null,
    })),
    metadataJson: result.metadata ? JSON.stringify(result.metadata) : null,
  };
}

@Resolver(() => TaxClassType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class TaxResolver {
  constructor(
    private readonly tax: TaxEngine,
    private readonly taxClasses: TaxClassesService,
    private readonly taxRules: TaxRulesService,
  ) {}

  @Query(() => [TaxProviderType], {
    name: 'taxProviders',
    description: 'List active registered tax providers',
  })
  @RequirePermission('tax:read')
  taxProviders(): TaxProviderType[] {
    return this.tax.list().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
    }));
  }

  @Query(() => [TaxClassType], {
    name: 'taxClasses',
    description: 'List tax classes',
  })
  @RequirePermission('tax:read')
  taxClassesList(): Promise<TaxClassType[]> {
    return this.taxClasses.findAll();
  }

  @Query(() => TaxClassType, {
    name: 'taxClass',
    description: 'Get tax class by id',
  })
  @RequirePermission('tax:read')
  taxClass(@Args('id', { type: () => ID }) id: string): Promise<TaxClassType> {
    return this.taxClasses.findById(id);
  }

  @Mutation(() => TaxClassType, {
    name: 'createTaxClass',
    description: 'Create a tax class',
  })
  @RequirePermission('tax:create')
  createTaxClass(
    @Args('input', { type: () => CreateTaxClassInput }) input: CreateTaxClassInput,
  ): Promise<TaxClassType> {
    return this.taxClasses.create(input);
  }

  @Mutation(() => TaxClassType, {
    name: 'updateTaxClass',
    description: 'Update a tax class',
  })
  @RequirePermission('tax:update')
  updateTaxClass(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateTaxClassInput }) input: UpdateTaxClassInput,
  ): Promise<TaxClassType> {
    return this.taxClasses.update(id, input);
  }

  @Mutation(() => TaxClassType, {
    name: 'deleteTaxClass',
    description: 'Delete a tax class (cascades rules)',
  })
  @RequirePermission('tax:delete')
  deleteTaxClass(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TaxClassType> {
    return this.taxClasses.remove(id);
  }

  @Query(() => [TaxRuleType], {
    name: 'taxRules',
    description: 'List tax rules (optionally filtered by tax class)',
  })
  @RequirePermission('tax:read')
  taxRulesList(
    @Args('taxClassId', { type: () => ID, nullable: true }) taxClassId?: string,
  ): Promise<TaxRuleType[]> {
    return this.taxRules.findAll(taxClassId);
  }

  @Query(() => TaxRuleType, {
    name: 'taxRule',
    description: 'Get tax rule by id',
  })
  @RequirePermission('tax:read')
  taxRule(@Args('id', { type: () => ID }) id: string): Promise<TaxRuleType> {
    return this.taxRules.findById(id);
  }

  @Mutation(() => TaxRuleType, {
    name: 'createTaxRule',
    description: 'Create a tax rule under a tax class',
  })
  @RequirePermission('tax:create')
  createTaxRule(
    @Args('input', { type: () => CreateTaxRuleInput }) input: CreateTaxRuleInput,
  ): Promise<TaxRuleType> {
    return this.taxRules.create(input);
  }

  @Mutation(() => TaxRuleType, {
    name: 'updateTaxRule',
    description: 'Update a tax rule',
  })
  @RequirePermission('tax:update')
  updateTaxRule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateTaxRuleInput }) input: UpdateTaxRuleInput,
  ): Promise<TaxRuleType> {
    return this.taxRules.update(id, input);
  }

  @Mutation(() => TaxRuleType, {
    name: 'deleteTaxRule',
    description: 'Delete a tax rule',
  })
  @RequirePermission('tax:delete')
  deleteTaxRule(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TaxRuleType> {
    return this.taxRules.remove(id);
  }

  @Query(() => TaxCalculateResultType, {
    name: 'calculateTax',
    description:
      'Admin preview: calculate tax via TaxEngine (inclusive or exclusive)',
  })
  @RequirePermission('tax:read')
  async calculateTax(
    @Args('input') input: CalculateTaxInput,
  ): Promise<TaxCalculateResultType> {
    const result = await this.tax.calculate(
      {
        currencyCode: input.currencyCode,
        pricingMode: input.pricingMode,
        address: input.address
          ? {
              countryCode: input.address.countryCode,
              postalCode: input.address.postalCode,
              province: input.address.province,
              city: input.address.city,
              line1: input.address.line1,
              line2: input.address.line2,
            }
          : undefined,
        items: input.items.map((item) => ({
          sku: item.sku,
          productId: item.productId,
          variantId: item.variantId,
          taxClassCode: item.taxClassCode,
          quantity: item.quantity,
          unitAmountMinor: item.unitAmountMinor,
        })),
        shippingMinor: input.shippingMinor,
        subtotalMinor: input.subtotalMinor,
        metadata: parseMetadataJson(input.metadataJson),
      },
      input.providerCode,
    );
    return toCalculateResultType(result);
  }
}
