import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLogEntity } from '../entities/audit-log.entity';
import type { AuditLogType } from './audit-log.types';

export type AppendAuditLogInput = {
  action: string;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListAuditLogsInput = {
  limit?: number;
  actionPrefix?: string | null;
  resourceType?: string | null;
  since?: Date | null;
};

/**
 * Append-only audit trail for sensitive auth / identity / ops actions.
 * No update or delete APIs — records are immutable once written.
 */
@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogs: Repository<AuditLogEntity>,
  ) {}

  async append(input: AppendAuditLogInput): Promise<AuditLogType> {
    const row = await this.auditLogs.save(
      this.auditLogs.create({
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? null,
      }),
    );
    return this.toType(row);
  }

  async listRecent(limit = 50): Promise<AuditLogType[]> {
    return this.list({ limit });
  }

  /**
   * Filtered activity / audit listing (newest first). Caps at 200 rows.
   */
  async list(input: ListAuditLogsInput = {}): Promise<AuditLogType[]> {
    const take = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const qb = this.auditLogs
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .take(take);

    if (input.actionPrefix) {
      qb.andWhere('a.action LIKE :actionPrefix', {
        actionPrefix: `${input.actionPrefix}%`,
      });
    }
    if (input.resourceType) {
      qb.andWhere('a.resourceType = :resourceType', {
        resourceType: input.resourceType,
      });
    }
    if (input.since) {
      qb.andWhere('a.createdAt >= :since', { since: input.since });
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toType(row));
  }

  private toType(row: AuditLogEntity): AuditLogType {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      metadataJson: row.metadata ? JSON.stringify(row.metadata) : null,
      createdAt: row.createdAt,
    };
  }
}
