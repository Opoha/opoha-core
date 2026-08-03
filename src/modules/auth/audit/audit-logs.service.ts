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

/**
 * Append-only audit trail for sensitive auth / identity actions (AC-MVP-021).
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
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.auditLogs.find({
      order: { createdAt: 'DESC' },
      take,
    });
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
