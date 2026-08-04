import { describe, expect, it, vi } from 'vitest';

import { BulkOpsService } from './bulk-ops.service';

describe('BulkOpsService', () => {
  it('bulkUpdateProducts continues on failure and audits', async () => {
    const products = {
      update: vi
        .fn()
        .mockResolvedValueOnce({ id: 'p1' })
        .mockRejectedValueOnce(new Error('missing')),
    };
    const inventory = { adjust: vi.fn() };
    const auditLogs = { append: vi.fn().mockResolvedValue({}) };
    const service = new BulkOpsService(products as never, inventory as never, auditLogs as never);

    const result = await service.bulkUpdateProducts(
      [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' },
      ],
      'actor-1',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results[1]?.error).toBe('missing');
    expect(auditLogs.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk.product.update',
        actorUserId: 'actor-1',
        metadata: expect.objectContaining({
          successCount: 1,
          failureCount: 1,
        }),
      }),
    );
  });

  it('bulkAdjustInventory continues on failure and audits', async () => {
    const products = { update: vi.fn() };
    const inventory = {
      adjust: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'inv-1',
          warehouseId: 'wh-1',
        })
        .mockRejectedValueOnce(new Error('bad delta')),
    };
    const auditLogs = { append: vi.fn().mockResolvedValue({}) };
    const service = new BulkOpsService(products as never, inventory as never, auditLogs as never);

    const result = await service.bulkAdjustInventory(
      [
        { variantId: 'v1', delta: 1 },
        { variantId: 'v2', delta: 0 },
      ],
      'actor-1',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results[0]?.inventoryItemId).toBe('inv-1');
    expect(auditLogs.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'bulk.inventory.adjust',
        actorUserId: 'actor-1',
      }),
    );
  });

  it('rejects empty or oversized batches', async () => {
    const service = new BulkOpsService(
      {} as never,
      {} as never,
      {
        append: vi.fn(),
      } as never,
    );

    await expect(service.bulkUpdateProducts([])).rejects.toThrow(/non-empty/);
    await expect(
      service.bulkAdjustInventory(
        Array.from({ length: 101 }, (_, i) => ({
          variantId: `v${i}`,
          delta: 1,
        })),
      ),
    ).rejects.toThrow(/exceeds max/);
  });
});
