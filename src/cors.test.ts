import { describe, expect, it } from 'vitest';

import { resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  it('uses explicit CORS_ORIGINS allowlist', () => {
    expect(resolveCorsOrigin('http://localhost:3010, https://admin.example.com', 'production')).toEqual([
      'http://localhost:3010',
      'https://admin.example.com',
    ]);
  });

  it('disables CORS in production when unset', () => {
    expect(resolveCorsOrigin('', 'production')).toBe(false);
  });

  it('allows localhost origins in development when unset', () => {
    const origin = resolveCorsOrigin('', 'development');
    expect(typeof origin).toBe('function');
    if (typeof origin !== 'function') {
      return;
    }
    origin('http://localhost:3010', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
    origin('https://evil.example', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
    });
    origin(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });
});
