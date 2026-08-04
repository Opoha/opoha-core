import { describe, expect, it, vi } from 'vitest';

import { SearchEngine } from './search-engine.service';
import { SearchProviderRegistry } from './search-provider.registry';
import type { SearchProvider, SearchQueryInput } from './search-provider';

function stubProvider(
  overrides: Partial<SearchProvider> & Pick<SearchProvider, 'code' | 'displayName'> = {
    code: 'memory',
    displayName: 'In-memory search',
  },
): SearchProvider {
  return {
    async indexDocument() {},
    async deleteDocument() {},
    async search(input: SearchQueryInput) {
      return {
        query: input.query,
        hits: [],
        total: 0,
        providerCode: overrides.code,
      };
    },
    ...overrides,
  };
}

describe('SearchEngine', () => {
  it('register / get / list providers by code', () => {
    const engine = new SearchEngine(new SearchProviderRegistry());
    engine.register(stubProvider());
    expect(engine.get('memory')?.displayName).toBe('In-memory search');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new SearchProviderRegistry();
    registry.register('a', stubProvider({ code: 'memory', displayName: 'A' }));
    expect(() =>
      registry.register('b', stubProvider({ code: 'memory', displayName: 'B' })),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    const registry = new SearchProviderRegistry();
    registry.register(
      'search-meili',
      stubProvider({ code: 'meilisearch', displayName: 'Meilisearch' }),
    );
    registry.deactivatePlugin('search-meili');
    expect(new SearchEngine(registry).get('meilisearch')).toBeUndefined();
    registry.activatePlugin('search-meili');
    expect(new SearchEngine(registry).get('meilisearch')).toBeDefined();
    registry.removePlugin('search-meili');
    expect(registry.list()).toHaveLength(0);
  });

  it('indexes and searches via registered provider', async () => {
    const indexed: string[] = [];
    const engine = new SearchEngine(new SearchProviderRegistry());
    engine.register(
      stubProvider({
        code: 'memory',
        displayName: 'Memory',
        async indexDocument(doc) {
          indexed.push(doc.id);
        },
        async search(input) {
          return {
            query: input.query,
            hits: indexed
              .filter((id) => id.includes(input.query) || input.query === '')
              .map((id) => ({ id, type: 'product' as const, title: id })),
            total: indexed.length,
            providerCode: 'memory',
          };
        },
      }),
    );

    await engine.indexDocument({
      id: 'prod-1',
      type: 'product',
      title: 'Widget',
      slug: 'widget',
    });
    expect(indexed).toEqual(['prod-1']);

    const result = await engine.search({ query: 'prod', type: 'product' });
    expect(result.providerCode).toBe('memory');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.id).toBe('prod-1');
  });

  it('soft-noops index/delete and returns empty search without providers', async () => {
    const engine = new SearchEngine(new SearchProviderRegistry());
    await engine.indexDocument({ id: 'p1', type: 'product', title: 'X' });
    await engine.deleteDocument({ id: 'p1', type: 'product' });
    const result = await engine.search({ query: 'x' });
    expect(result.hits).toEqual([]);
    expect(result.providerCode).toBe('none');
  });

  it('publishes IndexUpdated when event bus is present', async () => {
    const publish = vi.fn(async () => undefined);
    const engine = new SearchEngine(new SearchProviderRegistry(), {
      publish,
    } as never);
    engine.register(stubProvider());
    await engine.indexDocument({ id: 'p1', type: 'product', title: 'X' });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'IndexUpdated',
        aggregateType: 'search',
        aggregateId: 'p1',
        data: expect.objectContaining({
          action: 'indexed',
          documentId: 'p1',
          providerCode: 'memory',
        }),
      }),
    );
  });
});
