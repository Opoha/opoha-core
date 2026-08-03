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
    const repo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn().mockResolvedValue([
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
    const service = new AuditLogsService(repo as never);

    const rows = await service.listRecent(999);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadataJson).toBeNull();
    expect(repo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 200,
    });
  });
});
