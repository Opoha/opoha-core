/** Seed / fallback values for single-country deployments. */
export const DEFAULT_LOCALIZATION_SETTINGS = {
  countryCode: 'US',
  currencyCode: 'USD',
  timezone: 'UTC',
  defaultLocale: 'en-US',
} as const;

export type DefaultLocalizationSettings = typeof DEFAULT_LOCALIZATION_SETTINGS;
