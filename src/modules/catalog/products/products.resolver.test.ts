import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContributionRegistry } from '../../plugin-loader/public';
import {
  ProductsResolver,
  REVIEW_AGGREGATE_PROVIDER_TOKEN,
} from './products.resolver';
import type { ProductType } from './product.types';
import type { ProductsService } from './products.service';

describe('ProductsResolver.reviewAggregate (Phase 4 D-04)', () => {
  let contributions: ContributionRegistry;
  let resolver: ProductsResolver;

  const product = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Widget',
    slug: 'widget',
    description: null,
    isActive: true,
    createdAt: new Date('2026-08-03T00:00:00Z'),
    updatedAt: new Date('2026-08-03T00:00:00Z'),
  } satisfies ProductType;

  beforeEach(() => {
    contributions = new ContributionRegistry({
      subscribe: vi.fn(),
    } as never);
    resolver = new ProductsResolver(
      {} as ProductsService,
      contributions,
    );
  });

  it('returns null when no review provider is registered', () => {
    expect(resolver.reviewAggregate(product)).toBeNull();
  });

  it('returns null when provider is registered but inactive', () => {
    contributions.registerProvider({
      pluginId: 'product-review',
      token: REVIEW_AGGREGATE_PROVIDER_TOKEN,
      provider: {
        aggregate: () => ({ averageRating: 5, reviewCount: 1 }),
      },
      active: false,
    });
    expect(resolver.reviewAggregate(product)).toBeNull();
  });

  it('resolves aggregate via string token without importing the plugin', () => {
    const aggregate = vi.fn((productId: string) => ({
      productId,
      averageRating: 4.5,
      reviewCount: 2,
    }));
    contributions.registerProvider({
      pluginId: 'product-review',
      token: REVIEW_AGGREGATE_PROVIDER_TOKEN,
      provider: { aggregate },
    });

    expect(resolver.reviewAggregate(product)).toEqual({
      averageRating: 4.5,
      reviewCount: 2,
    });
    expect(aggregate).toHaveBeenCalledWith(product.id);
  });

  it('returns null when provider.aggregate returns nullish', () => {
    contributions.registerProvider({
      pluginId: 'product-review',
      token: REVIEW_AGGREGATE_PROVIDER_TOKEN,
      provider: { aggregate: () => null },
    });
    expect(resolver.reviewAggregate(product)).toBeNull();
  });
});
