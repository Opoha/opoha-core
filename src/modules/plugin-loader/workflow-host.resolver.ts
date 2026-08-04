import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { ContributionRegistry } from './contribution-registry';
import {
  UpsertWorkflowDefinitionGqlInput,
  WorkflowDefinitionGqlType,
  WorkflowRunGqlType,
} from './workflow-host.types';

/**
 * Documented contract for the optional `workflow.engine` provider
 * (see `@opoha/plugin-workflow`). Core never imports the plugin —
 * duck-typed agreement resolved by string token only
 *.
 */
export type WorkflowEngineProvider = {
  listDefinitions(): Promise<WorkflowDefinitionLike[]> | WorkflowDefinitionLike[];
  upsertDefinition(input: {
    code: string;
    name: string;
    triggerEvent?: string;
    steps: unknown[];
    isActive?: boolean;
    id?: string;
  }): Promise<WorkflowDefinitionLike> | WorkflowDefinitionLike;
  listRuns(): WorkflowRunLike[] | Promise<WorkflowRunLike[]>;
};

export type WorkflowDefinitionLike = {
  id: string;
  code: string;
  name: string;
  triggerEvent: string;
  steps: unknown[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowRunLike = {
  id: string;
  workflowCode: string;
  triggerEvent: string;
  aggregateId: string;
  status: string;
  stepResults: unknown[];
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export const WORKFLOW_ENGINE_PROVIDER_TOKEN = 'workflow.engine';

function toDefinitionGql(def: WorkflowDefinitionLike): WorkflowDefinitionGqlType {
  return {
    id: def.id,
    code: def.code,
    name: def.name,
    triggerEvent: def.triggerEvent,
    stepsJson: JSON.stringify(def.steps ?? []),
    isActive: def.isActive,
    createdAt: def.createdAt,
    updatedAt: def.updatedAt,
  };
}

function toRunGql(run: WorkflowRunLike): WorkflowRunGqlType {
  return {
    id: run.id,
    workflowCode: run.workflowCode,
    triggerEvent: run.triggerEvent,
    aggregateId: run.aggregateId,
    status: run.status,
    stepResultsJson: JSON.stringify(run.stepResults ?? []),
    error: run.error ?? null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt ?? null,
  };
}

function parseStepsJson(stepsJson: string): unknown[] {
  const trimmed = stepsJson.trim();
  if (!trimmed) {
    throw new BadRequestException('stepsJson is required');
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('stepsJson must encode a non-empty JSON array');
    }
    return parsed;
  } catch (err) {
    throw new BadRequestException(
      err instanceof Error ? err.message : 'stepsJson must be a valid JSON array string',
    );
  }
}

/**
 * Host GraphQL bridge for workflows via ContributionRegistry `workflow.engine`.
 */
@Resolver(() => WorkflowDefinitionGqlType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class WorkflowHostResolver {
  constructor(private readonly contributions: ContributionRegistry) {}

  private requireProvider(): WorkflowEngineProvider {
    const provider = this.contributions.getProvider<WorkflowEngineProvider>(
      WORKFLOW_ENGINE_PROVIDER_TOKEN,
    );
    if (!provider) {
      throw new BadRequestException(
        'Workflow provider "workflow.engine" is not registered or inactive — enable plugin-workflow',
      );
    }
    return provider;
  }

  @Query(() => [WorkflowDefinitionGqlType], {
    name: 'workflowDefinitions',
    description: 'List workflow definitions (requires enabled plugin-workflow)',
  })
  @RequirePermission('workflow:read')
  async workflowDefinitions(): Promise<WorkflowDefinitionGqlType[]> {
    const rows = await this.requireProvider().listDefinitions();
    return rows.map(toDefinitionGql);
  }

  @Query(() => WorkflowDefinitionGqlType, {
    name: 'workflowDefinition',
    description: 'Get a workflow definition by code',
  })
  @RequirePermission('workflow:read')
  async workflowDefinition(
    @Args('code', { type: () => String }) code: string,
  ): Promise<WorkflowDefinitionGqlType> {
    const rows = await this.requireProvider().listDefinitions();
    const found = rows.find((d) => d.code === code);
    if (!found) {
      throw new NotFoundException(`Workflow "${code}" not found`);
    }
    return toDefinitionGql(found);
  }

  @Query(() => [WorkflowRunGqlType], {
    name: 'workflowRuns',
    description: 'List workflow execution runs (newest first when available)',
  })
  @RequirePermission('workflow:read')
  async workflowRuns(): Promise<WorkflowRunGqlType[]> {
    const rows = await this.requireProvider().listRuns();
    return [...rows].reverse().map(toRunGql);
  }

  @Mutation(() => WorkflowDefinitionGqlType, {
    name: 'upsertWorkflowDefinition',
    description: 'Create or update a workflow definition via workflow.engine',
  })
  @RequirePermission('workflow:manage')
  async upsertWorkflowDefinition(
    @Args('input', { type: () => UpsertWorkflowDefinitionGqlInput })
    input: UpsertWorkflowDefinitionGqlInput,
  ): Promise<WorkflowDefinitionGqlType> {
    const steps = parseStepsJson(input.stepsJson);
    try {
      const saved = await this.requireProvider().upsertDefinition({
        code: input.code,
        name: input.name,
        triggerEvent: input.triggerEvent,
        steps,
        isActive: input.isActive,
        id: input.id,
      });
      return toDefinitionGql(saved);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'upsertWorkflowDefinition failed',
      );
    }
  }
}
