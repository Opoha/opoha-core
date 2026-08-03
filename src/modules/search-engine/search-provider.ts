/**
 * Search provider port — plugins implement; core never imports Meilisearch/OpenSearch/Algolia.
 * Phase 4 A-01: indexDocument / deleteDocument / search.
 */

/** Document type indexed by a search provider (products first; CMS later). */
export type SearchDocumentType = 'product' | string;

/** Opaque document handed to SearchProvider.indexDocument. */
export type SearchDocument = {
  id: string;
  type: SearchDocumentType;
  title?: string;
  slug?: string;
  description?: string | null;
  /** Caller-supplied idempotency key for safe retries / reindex. */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type SearchDeleteInput = {
  id: string;
  type?: SearchDocumentType;
  idempotencyKey?: string;
};

export type SearchQueryInput = {
  query: string;
  type?: SearchDocumentType;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  /** Provider code when multiple search providers are active. */
  providerCode?: string;
};

export type SearchHit = {
  id: string;
  type: SearchDocumentType;
  score?: number;
  title?: string;
  slug?: string;
  highlight?: string;
  metadata?: Record<string, unknown>;
};

export type SearchQueryResult = {
  query: string;
  hits: SearchHit[];
  total: number;
  providerCode: string;
  limit?: number;
  offset?: number;
};

/**
 * Search provider registered with the search engine.
 * Plugins (Meilisearch, OpenSearch, Algolia) implement index/delete/search.
 */
export type SearchProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  indexDocument(document: SearchDocument): Promise<void>;
  deleteDocument(input: SearchDeleteInput): Promise<void>;
  search(input: SearchQueryInput): Promise<SearchQueryResult>;
};

export type RegisteredSearchProvider = {
  pluginId: string;
  provider: SearchProvider;
  active: boolean;
};
