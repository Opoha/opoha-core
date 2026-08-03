import { describe, expect, it } from 'vitest';

import { FXRateProviderRegistry } from './fx-rate-provider.registry';
import type { FXRateProvider } from './fx-rate-provider';

function makeProvider(code: string): FXRateProvider {
  return {
    code,
    displayName: code,
    async getRate() {
      return { rate: 1 };
    },
  };
}

describe('FXRateProviderRegistry (unit)', () => {
  it('registers and looks up active providers only', () => {
    const registry = new FXRateProviderRegistry();
    registry.register('fx-plugin', makeProvider('oxr'), true);
    expect(registry.get('oxr')?.code).toBe('oxr');

    registry.deactivatePlugin('fx-plugin');
    expect(registry.get('oxr')).toBeUndefined();

    registry.activatePlugin('fx-plugin');
    expect(registry.get('oxr')?.code).toBe('oxr');
  });

  it('rejects empty provider code', () => {
    const registry = new FXRateProviderRegistry();
    expect(() =>
      registry.register('fx-plugin', makeProvider(''), true),
    ).toThrow(/code is required/);
  });

  it('rejects conflicting code from a different plugin', () => {
    const registry = new FXRateProviderRegistry();
    registry.register('fx-plugin-a', makeProvider('oxr'), true);
    expect(() =>
      registry.register('fx-plugin-b', makeProvider('oxr'), true),
    ).toThrow(/already registered/);
  });

  it('removePlugin clears its registrations', () => {
    const registry = new FXRateProviderRegistry();
    registry.register('fx-plugin', makeProvider('oxr'), true);
    registry.removePlugin('fx-plugin');
    expect(registry.get('oxr')).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
