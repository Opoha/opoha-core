import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { JobDefinitionGqlType, JobRunGqlType } from './jobs.gql.types';
import { JobsService } from './jobs.service';
import type { JobDefinitionType, JobRunType } from './jobs.types';

function toDefinitionGql(row: JobDefinitionType): JobDefinitionGqlType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    handlerKey: row.handlerKey,
    ownerPluginId: row.ownerPluginId,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRunGql(row: JobRunType): JobRunGqlType {
  return {
    id: row.id,
    jobDefinitionId: row.jobDefinitionId,
    status: row.status,
    attempt: row.attempt,
    queueJobId: row.queueJobId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

/**
 * Admin GraphQL for jobs observability (Phase 8 E-03).
 */
@Resolver(() => JobDefinitionGqlType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class JobsResolver {
  constructor(private readonly jobs: JobsService) {}

  @Query(() => [JobDefinitionGqlType], {
    name: 'jobDefinitions',
    description: 'List scheduled job definitions',
  })
  @RequirePermission('job:read')
  async jobDefinitions(): Promise<JobDefinitionGqlType[]> {
    const rows = await this.jobs.listDefinitions();
    return rows.map(toDefinitionGql);
  }

  @Query(() => JobDefinitionGqlType, {
    name: 'jobDefinition',
    description: 'Get a scheduled job by code',
  })
  @RequirePermission('job:read')
  async jobDefinition(
    @Args('code', { type: () => String }) code: string,
  ): Promise<JobDefinitionGqlType> {
    return toDefinitionGql(await this.jobs.findDefinitionByCode(code));
  }

  @Query(() => [JobRunGqlType], {
    name: 'jobRuns',
    description: 'List run history for a job code (newest first)',
  })
  @RequirePermission('job:read')
  async jobRuns(
    @Args('code', { type: () => String }) code: string,
  ): Promise<JobRunGqlType[]> {
    const rows = await this.jobs.listRuns(code);
    return rows.map(toRunGql);
  }

  @Mutation(() => String, {
    name: 'triggerJob',
    description: 'Manually enqueue a scheduled job by code',
  })
  @RequirePermission('job:trigger')
  async triggerJob(
    @Args('code', { type: () => String }) code: string,
  ): Promise<string> {
    return this.jobs.trigger(code);
  }
}
