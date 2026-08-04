import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import type { RuleActionRef, RuleConditions } from './rule-conditions';
import { RulesService } from './rules.service';
import type { RuleDefinitionType } from './rules.types';
import {
  CreateRuleDefinitionGqlInput,
  RuleDefinitionGqlType,
  UpdateRuleDefinitionGqlInput,
} from './rules.gql.types';

function parseConditionsJson(
  conditionsJson: string | undefined,
): RuleConditions | null | undefined {
  if (conditionsJson === undefined) {
    return undefined;
  }
  const trimmed = conditionsJson.trim();
  if (!trimmed || trimmed === 'null') {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null) {
      return null;
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('conditionsJson must encode a JSON object');
    }
    return parsed as RuleConditions;
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'conditionsJson must be a valid JSON object string',
    );
  }
}

function parseActionRefsJson(actionRefsJson: string | undefined): RuleActionRef[] | undefined {
  if (actionRefsJson === undefined) {
    return undefined;
  }
  const trimmed = actionRefsJson.trim();
  if (!trimmed || trimmed === 'null') {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('actionRefsJson must encode a JSON array');
    }
    return parsed as RuleActionRef[];
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'actionRefsJson must be a valid JSON array string',
    );
  }
}

function toGql(row: RuleDefinitionType): RuleDefinitionGqlType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    eventName: row.eventName,
    conditionsJson: row.conditions ? JSON.stringify(row.conditions) : null,
    actionRefsJson: JSON.stringify(row.actionRefs),
    enabled: row.enabled,
    priority: row.priority,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Resolver(() => RuleDefinitionGqlType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class RulesResolver {
  constructor(private readonly rules: RulesService) {}

  @Query(() => [RuleDefinitionGqlType], {
    name: 'ruleDefinitions',
    description: 'List automation rules',
  })
  @RequirePermission('rule:read')
  async ruleDefinitions(): Promise<RuleDefinitionGqlType[]> {
    const rows = await this.rules.findAll();
    return rows.map(toGql);
  }

  @Query(() => RuleDefinitionGqlType, {
    name: 'ruleDefinition',
    description: 'Get an automation rule by id',
  })
  @RequirePermission('rule:read')
  async ruleDefinition(@Args('id', { type: () => ID }) id: string): Promise<RuleDefinitionGqlType> {
    return toGql(await this.rules.findById(id));
  }

  @Query(() => RuleDefinitionGqlType, {
    name: 'ruleDefinitionByCode',
    description: 'Get an automation rule by code',
  })
  @RequirePermission('rule:read')
  async ruleDefinitionByCode(
    @Args('code', { type: () => String }) code: string,
  ): Promise<RuleDefinitionGqlType> {
    return toGql(await this.rules.findByCode(code));
  }

  @Mutation(() => RuleDefinitionGqlType, {
    name: 'createRuleDefinition',
    description: 'Create an automation rule',
  })
  @RequirePermission('rule:create')
  async createRuleDefinition(
    @Args('input', { type: () => CreateRuleDefinitionGqlInput })
    input: CreateRuleDefinitionGqlInput,
  ): Promise<RuleDefinitionGqlType> {
    const conditions = parseConditionsJson(input.conditionsJson);
    const actionRefs = parseActionRefsJson(input.actionRefsJson);
    return toGql(
      await this.rules.create({
        code: input.code,
        name: input.name,
        description: input.description,
        eventName: input.eventName,
        conditions: conditions === undefined ? undefined : conditions,
        actionRefs,
        enabled: input.enabled,
        priority: input.priority,
      }),
    );
  }

  @Mutation(() => RuleDefinitionGqlType, {
    name: 'updateRuleDefinition',
    description: 'Update an automation rule',
  })
  @RequirePermission('rule:update')
  async updateRuleDefinition(
    @Args('input', { type: () => UpdateRuleDefinitionGqlInput })
    input: UpdateRuleDefinitionGqlInput,
  ): Promise<RuleDefinitionGqlType> {
    const conditions = parseConditionsJson(input.conditionsJson);
    const actionRefs = parseActionRefsJson(input.actionRefsJson);
    return toGql(
      await this.rules.update({
        id: input.id,
        code: input.code,
        name: input.name,
        description: input.description,
        eventName: input.eventName,
        conditions,
        actionRefs,
        enabled: input.enabled,
        priority: input.priority,
      }),
    );
  }

  @Mutation(() => RuleDefinitionGqlType, {
    name: 'deleteRuleDefinition',
    description: 'Delete an automation rule',
  })
  @RequirePermission('rule:delete')
  async deleteRuleDefinition(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RuleDefinitionGqlType> {
    return toGql(await this.rules.remove(id));
  }
}
