/**
 * Public search-engine surface for other core modules and plugin registration.
 */
export { SearchEngineModule } from '../search-engine.module';
export { SearchEngine } from '../search-engine.service';
export { SearchProviderRegistry } from '../search-provider.registry';
export { SearchResolver } from '../search.resolver';
export { SearchIndexListener } from '../search-index.listener';
export type {
  SearchDocumentType,
  SearchDocument,
  SearchDeleteInput,
  SearchQueryInput,
  SearchHit,
  SearchQueryResult,
  SearchProvider,
  RegisteredSearchProvider,
} from '../search-provider';
export {
  SearchProviderType,
  SearchProductsInput,
  SearchHitType,
  SearchProductsResultType,
} from '../search.types';
