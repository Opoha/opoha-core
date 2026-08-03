import { UseGuards } from '@nestjs/common';
import {
  Args,
  GraphQLISODateTime,
  Int,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { AuditLogType } from './audit-log.types';
import { AuditLogsService } from './audit-logs.service';

@Resolver(() => AuditLogType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class AuditLogsResolver {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Query(() => [AuditLogType], {
    name: 'auditLogs',
    description: 'Recent append-only audit records (newest first)',
  })
  @RequirePermission('audit:read')
  auditLogs(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number,
    @Args('actionPrefix', { type: () => String, nullable: true })
    actionPrefix?: string,
    @Args('resourceType', { type: () => String, nullable: true })
    resourceType?: string,
    @Args('since', { type: () => GraphQLISODateTime, nullable: true })
    since?: Date,
  ): Promise<AuditLogType[]> {
    return this.auditLogsService.list({
      limit: limit ?? 50,
      actionPrefix,
      resourceType,
      since,
    });
  }

  @Query(() => [AuditLogType], {
    name: 'activityLogs',
    description:
      'Activity log over audit_logs (filters: actionPrefix, resourceType, since)',
  })
  @RequirePermission('audit:read')
  activityLogs(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number,
    @Args('actionPrefix', { type: () => String, nullable: true })
    actionPrefix?: string,
    @Args('resourceType', { type: () => String, nullable: true })
    resourceType?: string,
    @Args('since', { type: () => GraphQLISODateTime, nullable: true })
    since?: Date,
  ): Promise<AuditLogType[]> {
    return this.auditLogsService.list({
      limit: limit ?? 50,
      actionPrefix,
      resourceType,
      since,
    });
  }
}
