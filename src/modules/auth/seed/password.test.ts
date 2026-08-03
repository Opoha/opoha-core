import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password helpers', () => {
  it('hashes with scrypt$salt$hash format', () => {
    const hash = hashPassword('secret-password');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain('secret-password');
  });

  it('verifies a matching password', () => {
    const hash = hashPassword('correct-horse');
    expect(verifyPassword('correct-horse', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct-horse');
    expect(verifyPassword('wrong-battery', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('any', 'bcrypt$not-supported')).toBe(false);
    expect(verifyPassword('any', 'not-a-hash')).toBe(false);
    expect(verifyPassword('any', '')).toBe(false);
  });

  it('produces unique salts per hash', () => {
    const a = hashPassword('same');
    const b = hashPassword('same');
    expect(a).not.toBe(b);
    expect(verifyPassword('same', a)).toBe(true);
    expect(verifyPassword('same', b)).toBe(true);
  });
});
