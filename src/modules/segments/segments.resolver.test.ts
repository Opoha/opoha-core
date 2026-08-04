import { describe, expect, it, vi } from 'vitest';

import { SegmentsResolver } from './segments.resolver';
import type { CustomerSegmentType } from './segments.types';

const sample: CustomerSegmentType = {
  id: 'seg-1',
  code: 'vip',
  name: 'VIP',
  description: 'VIP customers',
  rules: { tags: { any: ['vip'] } },
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('SegmentsResolver', () => {
  it('lists and maps rulesJson', async () => {
    const segments = {
      findAll: vi.fn(async () => [sample]),
      findById: vi.fn(),
      findByCode: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      customerMatchesSegment: vi.fn(),
    };
    const resolver = new SegmentsResolver(segments as never);
    const rows = await resolver.customerSegments();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rulesJson).toBe(JSON.stringify(sample.rules));
    expect(rows[0]?.code).toBe('vip');
  });

  it('creates with parsed rulesJson', async () => {
    const segments = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByCode: vi.fn(),
      create: vi.fn(async (input) => ({
        ...sample,
        code: input.code,
        name: input.name,
        rules: input.rules ?? null,
      })),
      update: vi.fn(),
      remove: vi.fn(),
      customerMatchesSegment: vi.fn(),
    };
    const resolver = new SegmentsResolver(segments as never);
    const row = await resolver.createCustomerSegment({
      code: 'vip',
      name: 'VIP',
      rulesJson: JSON.stringify({ tags: { any: ['vip'] } }),
    });
    expect(segments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'vip',
        rules: { tags: { any: ['vip'] } },
      }),
    );
    expect(row.rulesJson).toContain('vip');
  });

  it('evaluates membership by code', async () => {
    const segments = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByCode: vi.fn(async () => sample),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      customerMatchesSegment: vi.fn(async () => true),
    };
    const resolver = new SegmentsResolver(segments as never);
    const result = await resolver.evaluateSegmentMembership({
      segmentCode: 'vip',
      customerId: 'cust-1',
      tags: ['vip'],
    });
    expect(result.matches).toBe(true);
    expect(result.segmentCode).toBe('vip');
  });
});
