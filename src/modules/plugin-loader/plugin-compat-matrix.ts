/**
 * Official plugin compatibility matrix (Phase 9 E-01/E-02).
 *
 * Source of truth for the *decision* (which plugins are certified) is the
 * workspace work plan Decisions table, mirrored in
 * `docs/readiness/official-plugin-matrix.md`. This file only maps each
 * certified plugin id to its sibling repo directory name so the
 * compatibility integration test (`plugin-compat.integration.test.ts`) and
 * CI workflow can discover/build/load them without static imports
 * (core never imports `@opoha/plugin-*`; ADR-0003).
 */
export type OfficialPluginMatrixEntry = {
  /** Plugin manifest id (matches `opoha.plugin.json#id`). */
  id: string;
  /** Sibling repo directory name, relative to the monorepo root (parent of opoha-core). */
  repoDir: string;
  /** Human-readable category for the matrix / evidence docs. */
  category:
    | 'payment'
    | 'shipping'
    | 'storage'
    | 'email'
    | 'tax'
    | 'promotions'
    | 'returns'
    | 'search'
    | 'cms'
    | 'capability';
};

/** 21 certified official plugins for v1.0 (`plugin-automation` deferred/empty; `plugin-sample` is a test fixture only). */
export const OFFICIAL_PLUGIN_MATRIX: readonly OfficialPluginMatrixEntry[] = [
  { id: 'manual-payment', repoDir: 'plugin-manual-payment', category: 'payment' },
  { id: 'stripe', repoDir: 'plugin-stripe', category: 'payment' },
  { id: 'omise', repoDir: 'plugin-omise', category: 'payment' },
  { id: 'paypal', repoDir: 'plugin-paypal', category: 'payment' },
  { id: 'shipping-flat-rate', repoDir: 'plugin-shipping-flat-rate', category: 'shipping' },
  { id: 'dhl', repoDir: 'plugin-dhl', category: 'shipping' },
  { id: 'storage-localfs', repoDir: 'plugin-storage-localfs', category: 'storage' },
  { id: 'storage-s3', repoDir: 'plugin-storage-s3', category: 'storage' },
  { id: 'mail-smtp', repoDir: 'plugin-mail-smtp', category: 'email' },
  { id: 'tax-standard', repoDir: 'plugin-tax-standard', category: 'tax' },
  { id: 'coupon', repoDir: 'plugin-coupon', category: 'promotions' },
  { id: 'discount', repoDir: 'plugin-discount', category: 'promotions' },
  { id: 'rma', repoDir: 'plugin-rma', category: 'returns' },
  { id: 'search-meilisearch', repoDir: 'plugin-search-meilisearch', category: 'search' },
  { id: 'cms', repoDir: 'plugin-cms', category: 'cms' },
  { id: 'product-review', repoDir: 'plugin-product-review', category: 'capability' },
  { id: 'wishlist', repoDir: 'plugin-wishlist', category: 'capability' },
  { id: 'marketplace', repoDir: 'plugin-marketplace', category: 'capability' },
  { id: 'pos', repoDir: 'plugin-pos', category: 'capability' },
  { id: 'subscription', repoDir: 'plugin-subscription', category: 'capability' },
  { id: 'workflow', repoDir: 'plugin-workflow', category: 'capability' },
] as const;
