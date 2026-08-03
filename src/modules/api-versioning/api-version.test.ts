import { describe, expect, it } from 'vitest';

import {
  DEFAULT_API_VERSION,
  MVP_API_VERSION_DATE,
  resolveApiVersion,
  unsupportedApiVersionMessage,
} from './api-version';

describe('resolveApiVersion', () => {
  it('defaults to 1 when header is omitted', () => {
    expect(resolveApiVersion(undefined)).toBe(DEFAULT_API_VERSION);
    expect(resolveApiVersion('')).toBe(DEFAULT_API_VERSION);
  });

  it('accepts 1 and the MVP date alias', () => {
    expect(resolveApiVersion('1')).toBe('1');
    expect(resolveApiVersion(MVP_API_VERSION_DATE)).toBe('1');
  });

  it('rejects unsupported versions', () => {
    expect(resolveApiVersion('2')).toBeNull();
    expect(resolveApiVersion('v1')).toBeNull();
  });
});

describe('ApiVersionMiddleware helpers', () => {
  it('describes unsupported versions clearly', () => {
    expect(unsupportedApiVersionMessage('99')).toContain('99');
    expect(unsupportedApiVersionMessage('99')).toContain(DEFAULT_API_VERSION);
  });
});
