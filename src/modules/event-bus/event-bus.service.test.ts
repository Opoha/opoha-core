import { describe, expect, it, vi } from 'vitest';

import { CoreEventName } from './event-catalog';
import { EventBusService } from './event-bus.service';
import { userRegisteredDataSchema } from '../auth/events/auth-events';

describe('EventBusService', () => {
  it('publishes to subscribed listeners with a validated envelope', async () => {
    const bus = new EventBusService();
    bus.registerSchema(CoreEventName.UserRegistered, userRegisteredDataSchema);

    const received: unknown[] = [];
    bus.subscribe(CoreEventName.UserRegistered, (event) => {
      received.push(event);
    });

    const userId = '11111111-1111-4111-8111-111111111111';
    const result = await bus.publish({
      eventName: CoreEventName.UserRegistered,
      aggregateType: 'user',
      aggregateId: userId,
      data: { userId, email: 'a@example.com', isActive: true },
    });

    expect(result.listenerCount).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(result.event.eventName).toBe(CoreEventName.UserRegistered);
    expect(received).toHaveLength(1);
    expect((received[0] as { data: { email: string } }).data.email).toBe('a@example.com');
  });

  it('isolates listener failures by default', async () => {
    const bus = new EventBusService();
    const ok = vi.fn();
    bus.subscribe(CoreEventName.UserDeleted, () => {
      throw new Error('boom');
    });
    bus.subscribe(CoreEventName.UserDeleted, ok);

    const result = await bus.publish({
      eventName: CoreEventName.UserDeleted,
      aggregateType: 'user',
      aggregateId: 'u-1',
      data: { userId: 'u-1', email: 'x@y.z' },
    });

    expect(ok).toHaveBeenCalledOnce();
    expect(result.failures).toHaveLength(1);
  });

  it('rethrows when a listener uses errorPolicy throw', async () => {
    const bus = new EventBusService();
    bus.subscribe(
      CoreEventName.UserUpdated,
      () => {
        throw new Error('critical');
      },
      { errorPolicy: 'throw' },
    );

    await expect(
      bus.publish({
        eventName: CoreEventName.UserUpdated,
        aggregateType: 'user',
        aggregateId: 'u-1',
        data: { userId: 'u-1' },
      }),
    ).rejects.toThrow('critical');
  });

  it('rejects invalid payload when a schema is registered', async () => {
    const bus = new EventBusService();
    bus.registerSchema(CoreEventName.UserRegistered, userRegisteredDataSchema);

    await expect(
      bus.publish({
        eventName: CoreEventName.UserRegistered,
        aggregateType: 'user',
        aggregateId: 'not-a-uuid',
        data: { userId: 'bad', email: 'nope', isActive: true },
      }),
    ).rejects.toThrow();
  });

  it('unsubscribes a listener', async () => {
    const bus = new EventBusService();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(CoreEventName.ProductCreated, handler);
    unsubscribe();
    await bus.publish({
      eventName: CoreEventName.ProductCreated,
      aggregateType: 'product',
      aggregateId: 'p-1',
      data: {},
    });
    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount(CoreEventName.ProductCreated)).toBe(0);
  });
});
