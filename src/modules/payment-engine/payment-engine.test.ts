import { describe, expect, it } from 'vitest';

import { PaymentEngine } from './payment-engine.service';
import { PaymentProviderRegistry } from './payment-provider.registry';

describe('PaymentEngine', () => {
  it('register / get / list providers by code', () => {
    const engine = new PaymentEngine(new PaymentProviderRegistry());
    engine.register({ code: 'manual', displayName: 'Manual' });
    expect(engine.get('manual')?.displayName).toBe('Manual');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new PaymentProviderRegistry();
    registry.register('a', { code: 'manual', displayName: 'A' });
    expect(() =>
      registry.register('b', { code: 'manual', displayName: 'B' }),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new PaymentProviderRegistry();
    registry.register('manual-payment', {
      code: 'manual',
      displayName: 'Manual',
    });
    registry.deactivatePlugin('manual-payment');
    expect(new PaymentEngine(registry).get('manual')).toBeUndefined();
    registry.activatePlugin('manual-payment');
    expect(new PaymentEngine(registry).get('manual')).toBeDefined();
    registry.removePlugin('manual-payment');
    expect(registry.list()).toHaveLength(0);
  });
});
