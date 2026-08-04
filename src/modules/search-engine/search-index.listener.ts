import { Injectable, OnModuleInit } from '@nestjs/common';

import type { DomainEvent } from '../event-bus/public';
import { CoreEventName, EventBusService } from '../event-bus/public';
import { SearchEngine } from './search-engine.service';

type ProductCreatedData = {
  productId: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

type ProductUpdatedData = {
  productId: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

type ProductDeletedData = {
  productId: string;
  slug?: string;
};

/**
 * Enqueues product index / delete jobs from catalog events (Phase 4 A-03).
 * Soft no-op when no SearchProvider is registered; handlers are idempotent
 * by product id (providers should upsert / delete by document id).
 */
@Injectable()
export class SearchIndexListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly search: SearchEngine,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(CoreEventName.ProductCreated, (event) =>
      this.onProductUpsert(event as DomainEvent<ProductCreatedData>),
    );
    this.eventBus.subscribe(CoreEventName.ProductUpdated, (event) =>
      this.onProductUpsert(event as DomainEvent<ProductUpdatedData>),
    );
    this.eventBus.subscribe(CoreEventName.ProductDeleted, (event) =>
      this.onProductDeleted(event as DomainEvent<ProductDeletedData>),
    );
  }

  private async onProductUpsert(
    event: DomainEvent<ProductCreatedData | ProductUpdatedData>,
  ): Promise<void> {
    const { productId, slug, name, description, isActive } = event.data;
    if (!productId) {
      return;
    }
    if (!isActive) {
      await this.search.deleteDocument({
        id: productId,
        type: 'product',
        idempotencyKey: `product:${productId}:inactive`,
      });
      return;
    }
    await this.search.indexDocument({
      id: productId,
      type: 'product',
      title: name,
      slug,
      description: description ?? null,
      idempotencyKey: `product:${productId}:${event.eventName}`,
      metadata: { isActive },
    });
  }

  private async onProductDeleted(event: DomainEvent<ProductDeletedData>): Promise<void> {
    const { productId } = event.data;
    if (!productId) {
      return;
    }
    await this.search.deleteDocument({
      id: productId,
      type: 'product',
      idempotencyKey: `product:${productId}:deleted`,
    });
  }
}
