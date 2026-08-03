import { describe, expect, it } from 'vitest';

import {
  FULFILLMENT_MODES,
  assertFulfillmentMode,
  isFulfillmentMode,
} from './fulfillment-mode';

describe('fulfillment-mode', () => {
  it('accepts physical, digital, service', () => {
    for (const mode of FULFILLMENT_MODES) {
      expect(isFulfillmentMode(mode)).toBe(true);
      expect(assertFulfillmentMode(mode)).toBe(mode);
    }
  });

  it('rejects unknown modes', () => {
    expect(isFulfillmentMode('download')).toBe(false);
    expect(() => assertFulfillmentMode('download')).toThrow(/fulfillmentMode/);
  });
});
