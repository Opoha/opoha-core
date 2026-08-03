import { describe, expect, it } from 'vitest';

import { generateOpaqueToken, hashOpaqueToken } from './token-hash';

describe('token-hash', () => {
  it('hashes deterministically', () => {
    expect(hashOpaqueToken('abc')).toBe(hashOpaqueToken('abc'));
    expect(hashOpaqueToken('abc')).not.toBe(hashOpaqueToken('abd'));
  });

  it('generates prefixed opaque tokens', () => {
    const token = generateOpaqueToken('opr_');
    expect(token.startsWith('opr_')).toBe(true);
    expect(token.length).toBeGreaterThan(20);
  });
});
