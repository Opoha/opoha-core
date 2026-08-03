/**
 * Public localization module surface.
 */
export { LocalizationModule } from '../localization.module';
export { LocalizationService } from '../localization.service';
export {
  LOCALIZATION_SETTINGS_KEY,
  LocalizationSettingsEntity,
  localizationEntities,
} from '../entities';
export { DEFAULT_LOCALIZATION_SETTINGS } from '../localization.defaults';
export type {
  LocalizationSettingsType,
  UpdateLocalizationSettingsInput,
} from '../localization.types';
export {
  seedLocalization,
  type SeedLocalizationResult,
  type SeedLocalizationStore,
} from '../seed/seed-localization';
