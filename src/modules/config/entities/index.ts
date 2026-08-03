import { StoreChannelSettingsEntity } from './store-channel-settings.entity';

export { StoreChannelSettingsEntity };
export type { StoreCatalogMode } from './store-channel-settings.entity';

/** TypeORM entities owned by the configuration module. */
export const configurationEntities = [StoreChannelSettingsEntity] as const;
