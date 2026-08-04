import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';

import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { BulkOpsResolver } from './bulk-ops.resolver';
import { ReportsResolver } from './reports.resolver';

describe('AdminOps resolvers RBAC', () => {
  const reflector = new Reflector();

  it('declares report:read on report queries', () => {
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ReportsResolver.prototype.ordersReport)).toEqual([
      'report:read',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, ReportsResolver.prototype.inventoryByWarehouseReport),
    ).toEqual(['report:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, ReportsResolver.prototype.fulfillmentThroughputReport),
    ).toEqual(['report:read']);
  });

  it('declares bulk:* permission keys on mutations', () => {
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, BulkOpsResolver.prototype.bulkUpdateProducts),
    ).toEqual(['bulk:product']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, BulkOpsResolver.prototype.bulkAdjustInventory),
    ).toEqual(['bulk:inventory']);
  });
});
