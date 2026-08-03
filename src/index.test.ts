import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME, getCorePackageName } from './index';

describe('@opoha/core scaffold', () => {
  it('exposes package identity', () => {
    expect(getCorePackageName()).toBe(CORE_PACKAGE_NAME);
  });
});
