import { DEFAULT_LOCALIZATION_SETTINGS } from '../localization.defaults';
import { LOCALIZATION_SETTINGS_KEY } from '../entities/localization-settings.entity';

export type SeedLocalizationStore = {
  localizationSettings: {
    findUnique: (args: {
      where: { key: string };
    }) => Promise<{
      key: string;
      countryCode: string;
      currencyCode: string;
      timezone: string;
      defaultLocale: string;
    } | null>;
    create: (args: {
      data: {
        key: string;
        countryCode: string;
        currencyCode: string;
        timezone: string;
        defaultLocale: string;
      };
    }) => Promise<{
      key: string;
      countryCode: string;
      currencyCode: string;
      timezone: string;
      defaultLocale: string;
    }>;
  };
};

export type SeedLocalizationResult = {
  key: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  defaultLocale: string;
  created: boolean;
};

/**
 * Idempotently ensure the singleton localization settings row exists.
 * Does not overwrite operator changes on re-seed.
 */
export async function seedLocalization(
  store: SeedLocalizationStore,
): Promise<SeedLocalizationResult> {
  const existing = await store.localizationSettings.findUnique({
    where: { key: LOCALIZATION_SETTINGS_KEY },
  });
  if (existing) {
    return { ...existing, created: false };
  }
  const created = await store.localizationSettings.create({
    data: {
      key: LOCALIZATION_SETTINGS_KEY,
      countryCode: DEFAULT_LOCALIZATION_SETTINGS.countryCode,
      currencyCode: DEFAULT_LOCALIZATION_SETTINGS.currencyCode,
      timezone: DEFAULT_LOCALIZATION_SETTINGS.timezone,
      defaultLocale: DEFAULT_LOCALIZATION_SETTINGS.defaultLocale,
    },
  });
  return { ...created, created: true };
}
