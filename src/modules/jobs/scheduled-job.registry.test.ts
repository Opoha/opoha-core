import { describe, expect, it } from 'vitest';

import { ScheduledJobRegistry } from './scheduled-job.registry';

function noopHandler(): void {
  // test double
}

describe('ScheduledJobRegistry', () => {
  it('registers a core job (no pluginId) and lists it active', () => {
    const registry = new ScheduledJobRegistry();
    const entry = registry.register(null, {
      code: 'core:cleanup',
      displayName: 'Cleanup',
      cron: '0 0 * * *',
      timezone: 'UTC',
      handlerKey: 'core:cleanup',
      handler: noopHandler,
    });

    expect(entry.active).toBe(true);
    expect(registry.get('core:cleanup')).toBe(entry);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list(true)).toHaveLength(1);
  });

  it('rejects a blank code', () => {
    const registry = new ScheduledJobRegistry();
    expect(() =>
      registry.register(null, {
        code: '  ',
        displayName: 'x',
        cron: '0 0 * * *',
        timezone: 'UTC',
        handlerKey: 'x',
        handler: noopHandler,
      }),
    ).toThrow(/code is required/);
  });

  it('throws on code conflict across different owners', () => {
    const registry = new ScheduledJobRegistry();
    registry.register('plugin-a', {
      code: 'plugin-a:renew',
      displayName: 'Renew',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-a:renew',
      handler: noopHandler,
    });

    expect(() =>
      registry.register('plugin-b', {
        code: 'plugin-a:renew',
        displayName: 'Renew (b)',
        cron: '0 * * * *',
        timezone: 'UTC',
        handlerKey: 'plugin-a:renew',
        handler: noopHandler,
      }),
    ).toThrow(/already registered/);
  });

  it('re-registering the same owner updates the entry in place', () => {
    const registry = new ScheduledJobRegistry();
    registry.register('plugin-a', {
      code: 'plugin-a:renew',
      displayName: 'Renew',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-a:renew',
      handler: noopHandler,
    });
    const updated = registry.register('plugin-a', {
      code: 'plugin-a:renew',
      displayName: 'Renew v2',
      cron: '0 */2 * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-a:renew',
      handler: noopHandler,
    });

    expect(registry.list()).toHaveLength(1);
    expect(updated.displayName).toBe('Renew v2');
    expect(updated.cron).toBe('0 */2 * * *');
  });

  it('activatePlugin / deactivatePlugin toggle only that plugin entries', () => {
    const registry = new ScheduledJobRegistry();
    registry.register('plugin-a', {
      code: 'plugin-a:job',
      displayName: 'A',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-a:job',
      handler: noopHandler,
    });
    registry.register('plugin-b', {
      code: 'plugin-b:job',
      displayName: 'B',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-b:job',
      handler: noopHandler,
    });

    registry.deactivatePlugin('plugin-a');
    expect(registry.get('plugin-a:job')).toBeUndefined();
    expect(registry.get('plugin-b:job')).toBeDefined();
    expect(registry.list(true)).toHaveLength(1);

    registry.activatePlugin('plugin-a');
    expect(registry.get('plugin-a:job')).toBeDefined();
    expect(registry.list(true)).toHaveLength(2);
  });

  it('removePlugin removes only that plugin entries and returns them', () => {
    const registry = new ScheduledJobRegistry();
    registry.register('plugin-a', {
      code: 'plugin-a:job',
      displayName: 'A',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'plugin-a:job',
      handler: noopHandler,
    });
    registry.register(null, {
      code: 'core:job',
      displayName: 'Core',
      cron: '0 * * * *',
      timezone: 'UTC',
      handlerKey: 'core:job',
      handler: noopHandler,
    });

    const removed = registry.removePlugin('plugin-a');
    expect(removed).toHaveLength(1);
    expect(removed[0]?.code).toBe('plugin-a:job');
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('core:job')).toBeDefined();
  });
});
