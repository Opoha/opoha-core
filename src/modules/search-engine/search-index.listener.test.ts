import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { SearchEngine } from './search-engine.service';
import { SearchIndexListener } from './search-index.listener';
import { SearchProviderRegistry } from './search-provider.registry';
import type { SearchDocument, SearchProvider } from './search-provider';

describe('SearchIndexListener', () => {
  let eventBus: EventBusService;
  let indexed: SearchDocument[];
  let deleted: string[];
  let engine: SearchEngine;

  beforeEach(() => {
    eventBus = new EventBusService();
    indexed = [];
    deleted = [];
    const registry = new SearchProviderRegistry();
    const provider: SearchProvider = {
      code: 'memory',
      displayName: 'Memory',
      async indexDocument(doc) {
        indexed.push(doc);
      },
      async deleteDocument(input) {
        deleted.push(input.id);
      },
      async search(input) {
        return {
          query: input.query,
          hits: [],
          total: 0,
          providerCode: 'memory',
        };
      },
    };
    registry.register('test', provider);
    engine = new SearchEngine(registry, eventBus);
    new SearchIndexListener(eventBus, engine).onModuleInit();
  });

  it('indexes on ProductCreated / ProductUpdated when active', async () => {
    await eventBus.publish({
      eventName: CoreEventName.ProductCreated,
      aggregateType: 'product',
      aggregateId: 'p1',
      data: {
        productId: 'p1',
        slug: 'widget',
        name: 'Widget',
        description: 'A widget',
        isActive: true,
      },
    });
    expect(indexed).toHaveLength(1);
    expect(indexed[0]).toMatchObject({
      id: 'p1',
      type: 'product',
      title: 'Widget',
      slug: 'widget',
    });

    await eventBus.publish({
      eventName: CoreEventName.ProductUpdated,
      aggregateType: 'product',
      aggregateId: 'p1',
      data: {
        productId: 'p1',
        slug: 'widget-2',
        name: 'Widget 2',
        isActive: true,
      },
    });
    expect(indexed).toHaveLength(2);
    expect(indexed[1]?.slug).toBe('widget-2');
  });

  it('deletes on ProductDeleted and when product becomes inactive', async () => {
    await eventBus.publish({
      eventName: CoreEventName.ProductDeleted,
      aggregateType: 'product',
      aggregateId: 'p2',
      data: { productId: 'p2', slug: 'gone' },
    });
    expect(deleted).toEqual(['p2']);

    await eventBus.publish({
      eventName: CoreEventName.ProductUpdated,
      aggregateType: 'product',
      aggregateId: 'p3',
      data: {
        productId: 'p3',
        slug: 'off',
        name: 'Off',
        isActive: false,
      },
    });
    expect(deleted).toContain('p3');
  });

  it('is idempotent for repeated create events (same document id)', async () => {
    const payload = {
      productId: 'p1',
      slug: 'widget',
      name: 'Widget',
      isActive: true,
    };
    await eventBus.publish({
      eventName: CoreEventName.ProductCreated,
      aggregateType: 'product',
      aggregateId: 'p1',
      data: payload,
    });
    await eventBus.publish({
      eventName: CoreEventName.ProductCreated,
      aggregateType: 'product',
      aggregateId: 'p1',
      data: payload,
    });
    expect(indexed.map((d) => d.id)).toEqual(['p1', 'p1']);
  });

  it('soft-noops when no search provider is registered', async () => {
    const bareBus = new EventBusService();
    const bareEngine = new SearchEngine(new SearchProviderRegistry(), bareBus);
    const indexSpy = vi.spyOn(bareEngine, 'indexDocument');
    new SearchIndexListener(bareBus, bareEngine).onModuleInit();
    await bareBus.publish({
      eventName: CoreEventName.ProductCreated,
      aggregateType: 'product',
      aggregateId: 'p1',
      data: {
        productId: 'p1',
        slug: 'x',
        name: 'X',
        isActive: true,
      },
    });
    expect(indexSpy).toHaveBeenCalled();
    // engine itself soft-noops without providers
  });
});
