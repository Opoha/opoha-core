import { describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { ActivityAuditListener } from './activity-audit.listener';

describe('ActivityAuditListener', () => {
  it('registers warehouse / shipment / return audit bridges', async () => {
    const subscribe = vi.fn();
    const append = vi.fn().mockResolvedValue({});
    const listener = new ActivityAuditListener(
      { subscribe } as never,
      { append } as never,
    );

    listener.onModuleInit();

    expect(subscribe).toHaveBeenCalledWith(
      CoreEventName.WarehouseUpdated,
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalledWith(
      CoreEventName.ShipmentCreated,
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalledWith(
      CoreEventName.ReturnRequested,
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalledWith(
      CoreEventName.RefundCompleted,
      expect.any(Function),
    );

    const warehouseHandler = subscribe.mock.calls.find(
      (call) => call[0] === CoreEventName.WarehouseUpdated,
    )?.[1] as (event: unknown) => Promise<void>;

    await warehouseHandler({
      data: {
        warehouseId: '11111111-1111-1111-1111-111111111111',
        code: 'MAIN',
        name: 'Main',
        action: 'created',
      },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'warehouse.create',
        resourceType: 'warehouse',
      }),
    );
  });
});
