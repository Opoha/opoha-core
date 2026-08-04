import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import type { SegmentRules } from './segment-rules';
import { SegmentsService } from './segments.service';
import type { CustomerSegmentType } from './segments.types';
import {
  CreateCustomerSegmentGqlInput,
  CustomerSegmentGqlType,
  EvaluateSegmentMembershipInput,
  SegmentMembershipResultType,
  UpdateCustomerSegmentGqlInput,
} from './segments.gql.types';

function parseRulesJson(rulesJson: string | undefined): SegmentRules | null | undefined {
  if (rulesJson === undefined) {
    return undefined;
  }
  const trimmed = rulesJson.trim();
  if (!trimmed || trimmed === 'null') {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null) {
      return null;
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('rulesJson must encode a JSON object');
    }
    return parsed as SegmentRules;
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'rulesJson must be a valid JSON object string',
    );
  }
}

function toGql(row: CustomerSegmentType): CustomerSegmentGqlType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    rulesJson: row.rules ? JSON.stringify(row.rules) : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver(() => CustomerSegmentGqlType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class SegmentsResolver {
  constructor(private readonly segments: SegmentsService) {}

  @Query(() => [CustomerSegmentGqlType], {
    name: 'customerSegments',
    description: 'List customer segments',
  })
  @RequirePermission('segment:read')
  async customerSegments(): Promise<CustomerSegmentGqlType[]> {
    const rows = await this.segments.findAll();
    return rows.map(toGql);
  }

  @Query(() => CustomerSegmentGqlType, {
    name: 'customerSegment',
    description: 'Get a customer segment by id',
  })
  @RequirePermission('segment:read')
  async customerSegment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerSegmentGqlType> {
    return toGql(await this.segments.findById(id));
  }

  @Query(() => CustomerSegmentGqlType, {
    name: 'customerSegmentByCode',
    description: 'Get a customer segment by code',
  })
  @RequirePermission('segment:read')
  async customerSegmentByCode(
    @Args('code', { type: () => String }) code: string,
  ): Promise<CustomerSegmentGqlType> {
    return toGql(await this.segments.findByCode(code));
  }

  @Query(() => SegmentMembershipResultType, {
    name: 'evaluateSegmentMembership',
    description:
      'Preview whether a customer context matches a segment (v0.5 stubs for tags/orderCount/spend)',
  })
  @RequirePermission('segment:read')
  async evaluateSegmentMembership(
    @Args('input', { type: () => EvaluateSegmentMembershipInput })
    input: EvaluateSegmentMembershipInput,
  ): Promise<SegmentMembershipResultType> {
    const segment = input.segmentId?.trim()
      ? await this.segments.findById(input.segmentId.trim())
      : input.segmentCode?.trim()
        ? await this.segments.findByCode(input.segmentCode.trim())
        : null;
    if (!segment) {
      throw new BadRequestException('segmentId or segmentCode is required');
    }

    const matches = await this.segments.customerMatchesSegment(segment.id, {
      customerId: input.customerId,
      tags: input.tags,
      orderCount: input.orderCount,
      spendMinor: input.spendMinor,
    });

    return {
      matches,
      segmentId: segment.id,
      segmentCode: segment.code,
    };
  }

  @Mutation(() => CustomerSegmentGqlType, {
    name: 'createCustomerSegment',
    description: 'Create a customer segment',
  })
  @RequirePermission('segment:create')
  async createCustomerSegment(
    @Args('input', { type: () => CreateCustomerSegmentGqlInput })
    input: CreateCustomerSegmentGqlInput,
  ): Promise<CustomerSegmentGqlType> {
    const rules = parseRulesJson(input.rulesJson);
    return toGql(
      await this.segments.create({
        code: input.code,
        name: input.name,
        description: input.description,
        rules: rules === undefined ? undefined : rules,
        isActive: input.isActive,
      }),
    );
  }

  @Mutation(() => CustomerSegmentGqlType, {
    name: 'updateCustomerSegment',
    description: 'Update a customer segment',
  })
  @RequirePermission('segment:update')
  async updateCustomerSegment(
    @Args('input', { type: () => UpdateCustomerSegmentGqlInput })
    input: UpdateCustomerSegmentGqlInput,
  ): Promise<CustomerSegmentGqlType> {
    const rules = parseRulesJson(input.rulesJson);
    return toGql(
      await this.segments.update({
        id: input.id,
        code: input.code,
        name: input.name,
        description: input.description,
        rules,
        isActive: input.isActive,
      }),
    );
  }

  @Mutation(() => CustomerSegmentGqlType, {
    name: 'deleteCustomerSegment',
    description: 'Delete a customer segment',
  })
  @RequirePermission('segment:delete')
  async deleteCustomerSegment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerSegmentGqlType> {
    return toGql(await this.segments.remove(id));
  }
}
