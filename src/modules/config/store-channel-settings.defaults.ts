import type { StoreCatalogMode } from './entities';

/** Defaults applied when a store has no channel settings row yet. */
export const DEFAULT_STORE_CHANNEL_SETTINGS = {
  timezone: 'UTC',
  countryCode: 'US',
  catalogMode: 'shared' as StoreCatalogMode,
  settingsJson: {} as Record<string, unknown>,
} as const;
