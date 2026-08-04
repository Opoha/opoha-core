import { BadRequestException, Injectable, Optional } from '@nestjs/common';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { SearchProviderRegistry } from './search-provider.registry';
import type {
  SearchDeleteInput,
  SearchDocument,
  SearchProvider,
  SearchQueryInput,
  SearchQueryResult,
} from './search-provider';

/**
 * Search engine — register / get / list providers + index / delete / search.
 * Catalog listeners enqueue via indexDocument / deleteDocument.
 */
@Injectable()
export class SearchEngine {
  constructor(
    private readonly registry: SearchProviderRegistry,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  register(provider: SearchProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): SearchProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly SearchProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }

  /** True when at least one search provider is active. */
  hasActiveProvider(): boolean {
    return this.registry.list(true).length > 0;
  }

  /**
   * Index a document via a specific provider, or all active providers when omitted.
   * Idempotent when callers supply the same document id / idempotencyKey.
   * Soft no-op when no provider is registered (plugins install later).
   */
  async indexDocument(document: SearchDocument, providerCode?: string): Promise<void> {
    this.requireDocument(document);
    const providers = this.resolveProviders(providerCode);
    if (providers.length === 0) {
      return;
    }
    for (const provider of providers) {
      try {
        await provider.indexDocument(document);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error ? err.message : `Search provider "${provider.code}" failed to index`,
        );
      }
      await this.publishIndexUpdated({
        action: 'indexed',
        documentId: document.id,
        documentType: document.type,
        providerCode: provider.code,
      });
    }
  }

  /**
   * Delete a document via a specific provider, or all active providers when omitted.
   * Soft no-op when no provider is registered.
   */
  async deleteDocument(input: SearchDeleteInput, providerCode?: string): Promise<void> {
    if (!input.id?.trim()) {
      throw new BadRequestException('Search delete id is required');
    }
    const providers = this.resolveProviders(providerCode);
    if (providers.length === 0) {
      return;
    }
    for (const provider of providers) {
      try {
        await provider.deleteDocument(input);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error
            ? err.message
            : `Search provider "${provider.code}" failed to delete`,
        );
      }
      await this.publishIndexUpdated({
        action: 'deleted',
        documentId: input.id,
        documentType: input.type ?? 'product',
        providerCode: provider.code,
      });
    }
  }

  /**
   * Query products (or other document types) via a registered provider.
   * When no provider is registered, returns an empty result set.
   */
  async search(input: SearchQueryInput, providerCode?: string): Promise<SearchQueryResult> {
    if (typeof input.query !== 'string') {
      throw new BadRequestException('Search query is required');
    }
    const code = providerCode ?? input.providerCode;
    if (!this.hasActiveProvider()) {
      return {
        query: input.query,
        hits: [],
        total: 0,
        providerCode: code?.trim() || 'none',
        limit: input.limit,
        offset: input.offset,
      };
    }
    const provider = this.resolveProvider(code);
    try {
      const result = await provider.search({
...input,
        type: input.type ?? 'product',
      });
      return {
...result,
        providerCode: result.providerCode || provider.code,
      };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : `Search provider "${provider.code}" failed to search`,
      );
    }
  }

  private resolveProvider(providerCode?: string): SearchProvider {
    if (providerCode?.trim()) {
      const provider = this.registry.get(providerCode.trim());
      if (!provider) {
        throw new BadRequestException(
          `Search provider "${providerCode}" is not registered or inactive`,
        );
      }
      return provider;
    }
    const active = this.registry.list(true);
    if (active.length === 0) {
      throw new BadRequestException('No search provider is registered');
    }
    if (active.length > 1) {
      throw new BadRequestException('Multiple search providers are active; specify providerCode');
    }
    return active[0]!.provider;
  }

  private resolveProviders(providerCode?: string): SearchProvider[] {
    if (providerCode?.trim()) {
      const provider = this.registry.get(providerCode.trim());
      if (!provider) {
        throw new BadRequestException(
          `Search provider "${providerCode}" is not registered or inactive`,
        );
      }
      return [provider];
    }
    return this.registry.list(true).map((e) => e.provider);
  }

  private requireDocument(document: SearchDocument): void {
    if (!document.id?.trim()) {
      throw new BadRequestException('Search document id is required');
    }
    if (!document.type || String(document.type).trim().length === 0) {
      throw new BadRequestException('Search document type is required');
    }
  }

  private async publishIndexUpdated(data: {
    action: 'indexed' | 'deleted';
    documentId: string;
    documentType: string;
    providerCode: string;
  }): Promise<void> {
    if (!this.eventBus) {
      return;
    }
    await this.eventBus.publish({
      eventName: CoreEventName.IndexUpdated,
      aggregateType: 'search',
      aggregateId: data.documentId,
      data,
    });
  }
}
