import { describe, expect, it, vi } from 'vitest';

import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  const now = new Date('2026-08-03T12:00:00.000Z');

  it('appends an immutable audit row', async () => {
    const saved = {
      id: 'aud-1',
      actorUserId: 'user-1',
      action: 'auth.login',
      resourceType: 'user',
      resourceId: 'user-1',
      metadata: { email: 'a@b.c' },
      createdAt: now,
    };
    const repo = {
      create: vi.fn((input: unknown) => input),
      save: vi.fn().mockResolvedValue(saved),
      find: vi.fn(),
    };
    const service = new AuditLogsService(repo as never);

    const row = await service.append({
      action: 'auth.login',
      actorUserId: 'user-1',
      resourceType: 'user',
      resourceId: 'user-1',
      metadata: { email: 'a@b.c' },
    });

    expect(row.id).toBe('aud-1');
    expect(row.metadataJson).toBe(JSON.stringify({ email: 'a@b.c' }));
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('lists recent rows newest-first with capped limit', async () => {
    const qb = {
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        {
          id: 'aud-2',
          actorUserId: null,
          action: 'auth.logout',
          resourceType: null,
          resourceId: null,
          metadata: null,
          createdAt: now,
        },
      ]),
    };
    const repo = {
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
    };
    const service = new AuditLogsService(repo as never);

    const rows = await service.listRecent(999);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadataJson).toBeNull();
    expect(qb.take).toHaveBeenCalledWith(200);
  });

  it('filters activity logs by actionPrefix and resourceType', async () => {
    const qb = {
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    const repo = {
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(qb),
    };
    const service = new AuditLogsService(repo as never);

    await service.list({
      limit: 10,
      actionPrefix: 'warehouse.',
      resourceType: 'warehouse',
      since: now,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'a.action LIKE :actionPrefix',
      { actionPrefix: 'warehouse.%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'a.resourceType = :resourceType',
      { resourceType: 'warehouse' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :since', {
      since: now,
    });
  });
});
