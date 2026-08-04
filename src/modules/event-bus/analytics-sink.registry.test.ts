import { describe, expect, it } from 'vitest';

import { AnalyticsSinkRegistry } from './analytics-sink.registry';
import type { AnalyticsSink } from './analytics-sink';

function makeSink(code: string): AnalyticsSink {
  return {
    code,
    displayName: code,
    handle: async () => undefined,
  };
}

describe('AnalyticsSinkRegistry (F-04)', () => {
  it('registers, lists, and resolves active sinks by code', () => {
    const registry = new AnalyticsSinkRegistry();
    const sink = makeSink('ga4');
    registry.register('plugin-analytics', sink);

    expect(registry.get('ga4')).toBe(sink);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list(true)).toHaveLength(1);
  });

  it('rejects a conflicting code registered by a different plugin', () => {
    const registry = new AnalyticsSinkRegistry();
    registry.register('plugin-a', makeSink('shared'));
    expect(() => registry.register('plugin-b', makeSink('shared'))).toThrow(/already registered/);
  });

  it('updates an existing entry when the same plugin re-registers', () => {
    const registry = new AnalyticsSinkRegistry();
    const first = makeSink('ga4');
    const second = makeSink('ga4');
    registry.register('plugin-analytics', first);
    registry.register('plugin-analytics', second);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('ga4')).toBe(second);
  });

  it('activates / deactivates / removes sinks by plugin id', () => {
    const registry = new AnalyticsSinkRegistry();
    registry.register('plugin-analytics', makeSink('ga4'), false);
    expect(registry.get('ga4')).toBeUndefined();

    registry.activatePlugin('plugin-analytics');
    expect(registry.get('ga4')).toBeDefined();

    registry.deactivatePlugin('plugin-analytics');
    expect(registry.get('ga4')).toBeUndefined();
    expect(registry.list(true)).toHaveLength(0);

    registry.removePlugin('plugin-analytics');
    expect(registry.list()).toHaveLength(0);
  });

  it('rejects sinks with an empty code', () => {
    const registry = new AnalyticsSinkRegistry();
    expect(() => registry.register('plugin-analytics', makeSink(''))).toThrow(/code is required/);
  });
});
