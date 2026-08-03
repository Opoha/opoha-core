import { describe, expect, it } from 'vitest';

import {
  STORE_CODE_HEADER,
  STORE_ID_HEADER,
  extractStoreContextFromHeaders,
  extractStoreContextFromJwt,
  resolveStoreContext,
} from './store-context';

describe('store-context helpers', () => {
  it('reads store id and code from headers', () => {
    const ref = extractStoreContextFromHeaders({
      [STORE_ID_HEADER]: '11111111-1111-4111-8111-111111111111',
      [STORE_CODE_HEADER]: ' US-WEB ',
    });
    expect(ref).toEqual({
      storeId: '11111111-1111-4111-8111-111111111111',
      storeCode: 'US-WEB',
      source: 'header',
    });
  });

  it('returns none when headers absent', () => {
    expect(extractStoreContextFromHeaders({})).toEqual({ source: 'none' });
  });

  it('reads optional JWT claims', () => {
    expect(
      extractStoreContextFromJwt({
        storeId: '11111111-1111-4111-8111-111111111111',
        storeCode: 'DEFAULT',
      }),
    ).toEqual({
      storeId: '11111111-1111-4111-8111-111111111111',
      storeCode: 'DEFAULT',
      source: 'jwt',
    });
  });

  it('prefers headers over JWT', () => {
    const ref = resolveStoreContext({
      headers: { [STORE_CODE_HEADER]: 'HEADER' },
      jwt: { storeCode: 'JWT' },
    });
    expect(ref).toEqual({ storeCode: 'HEADER', source: 'header' });
  });

  it('falls back to JWT when headers empty', () => {
    const ref = resolveStoreContext({
      headers: {},
      jwt: { storeId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(ref.source).toBe('jwt');
    expect(ref.storeId).toBe('11111111-1111-4111-8111-111111111111');
  });
});
