import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';

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
  ): Promise<AuditLogType[]> {
    return this.auditLogsService.listRecent(limit ?? 50);
  }
}
