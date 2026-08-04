import { describe, expect, it } from 'vitest';

import { ORDER_SOURCES, assertOrderSource, isOrderSource } from './order-source';

describe('order-source', () => {
  it('accepts web, pos, marketplace', () => {
    for (const source of ORDER_SOURCES) {
      expect(isOrderSource(source)).toBe(true);
      expect(assertOrderSource(source)).toBe(source);
    }
  });

  it('rejects unknown sources', () => {
    expect(isOrderSource('mobile')).toBe(false);
    expect(() => assertOrderSource('mobile')).toThrow(/orderSource/);
  });
});
