import { describe, expect, it } from 'vitest';

import { evaluateRuleConditions } from './rule-conditions';

describe('evaluateRuleConditions', () => {
  it('matches everything when conditions are null/empty', () => {
    expect(evaluateRuleConditions(null, { a: 1 })).toBe(true);
    expect(evaluateRuleConditions({}, { a: 1 })).toBe(true);
    expect(evaluateRuleConditions({ equals: [] }, { a: 1 })).toBe(true);
  });

  it('evaluates equals with match=all (default)', () => {
    const data = { currencyCode: 'USD', totalMinor: '5000' };
    expect(
      evaluateRuleConditions(
        {
          equals: [
            { path: 'currencyCode', value: 'USD' },
            { path: 'totalMinor', value: '5000' },
          ],
        },
        data,
      ),
    ).toBe(true);
    expect(
      evaluateRuleConditions(
        {
          equals: [
            { path: 'currencyCode', value: 'USD' },
            { path: 'totalMinor', value: '1' },
          ],
        },
        data,
      ),
    ).toBe(false);
  });

  it('evaluates equals with match=any', () => {
    expect(
      evaluateRuleConditions(
        {
          match: 'any',
          equals: [
            { path: 'currencyCode', value: 'EUR' },
            { path: 'currencyCode', value: 'USD' },
          ],
        },
        { currencyCode: 'USD' },
      ),
    ).toBe(true);
  });

  it('supports nested paths', () => {
    expect(
      evaluateRuleConditions(
        { equals: [{ path: 'meta.source', value: 'pos' }] },
        { meta: { source: 'pos' } },
      ),
    ).toBe(true);
  });
});
