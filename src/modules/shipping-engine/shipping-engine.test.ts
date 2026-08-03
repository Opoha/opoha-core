import { describe, expect, it } from 'vitest';

import { ShippingEngine } from './shipping-engine.service';
import { ShippingMethodRegistry } from './shipping-method.registry';

describe('ShippingEngine', () => {
  it('register / get / list methods by code', () => {
    const engine = new ShippingEngine(new ShippingMethodRegistry());
    engine.register({ code: 'flat-rate', displayName: 'Flat rate' });
    expect(engine.get('flat-rate')?.displayName).toBe('Flat rate');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new ShippingMethodRegistry();
    registry.register('a', { code: 'flat-rate', displayName: 'A' });
    expect(() =>
      registry.register('b', { code: 'flat-rate', displayName: 'B' }),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new ShippingMethodRegistry();
    registry.register('shipping-flat-rate', {
      code: 'flat-rate',
      displayName: 'Flat rate',
    });
    registry.deactivatePlugin('shipping-flat-rate');
    expect(new ShippingEngine(registry).get('flat-rate')).toBeUndefined();
    registry.activatePlugin('shipping-flat-rate');
    expect(new ShippingEngine(registry).get('flat-rate')).toBeDefined();
    registry.removePlugin('shipping-flat-rate');
    expect(registry.list()).toHaveLength(0);
  });
});
