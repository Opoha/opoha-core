import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { SearchEngine } from './search-engine.service';
import {
  SearchProductsInput,
  SearchProductsResultType,
  SearchProviderType,
} from './search.types';

@Resolver(() => SearchProviderType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class SearchResolver {
  constructor(private readonly search: SearchEngine) {}

  @Query(() => [SearchProviderType], {
    name: 'searchProviders',
    description: 'List active registered search providers',
  })
  @RequirePermission('search:read')
  searchProviders(): SearchProviderType[] {
    return this.search.list().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
    }));
  }

  @Query(() => SearchProductsResultType, {
    name: 'searchProducts',
    description:
      'Search indexed products via the active SearchProvider (empty when none registered)',
  })
  @RequirePermission('search:read')
  async searchProducts(
    @Args('input', { type: () => SearchProductsInput })
    input: SearchProductsInput,
  ): Promise<SearchProductsResultType> {
    const result = await this.search.search({
      query: input.query,
      type: 'product',
      limit: input.limit,
      offset: input.offset,
      providerCode: input.providerCode,
    });
    return {
      query: result.query,
      hits: result.hits.map((hit) => ({
        id: hit.id,
        type: String(hit.type),
        score: hit.score ?? null,
        title: hit.title ?? null,
        slug: hit.slug ?? null,
        highlight: hit.highlight ?? null,
      })),
      total: result.total,
      providerCode: result.providerCode,
      limit: result.limit ?? null,
      offset: result.offset ?? null,
    };
  }
}
