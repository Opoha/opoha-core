import type { DataSource } from 'typeorm';

import { LocalizationSettingsEntity } from '../entities/localization-settings.entity';
import type { SeedLocalizationStore } from './seed-localization';

export function createTypeOrmLocalizationSeedStore(dataSource: DataSource): SeedLocalizationStore {
  const settings = dataSource.getRepository(LocalizationSettingsEntity);

  return {
    localizationSettings: {
      async findUnique({ where }) {
        const row = await settings.findOne({ where: { key: where.key } });
        if (!row) {
          return null;
        }
        return {
          key: row.key,
          countryCode: row.countryCode,
          currencyCode: row.currencyCode,
          timezone: row.timezone,
          defaultLocale: row.defaultLocale,
        };
      },
      async create({ data }) {
        const row = await settings.save(
          settings.create({
            key: data.key,
            countryCode: data.countryCode,
            currencyCode: data.currencyCode,
            timezone: data.timezone,
            defaultLocale: data.defaultLocale,
          }),
        );
        return {
          key: row.key,
          countryCode: row.countryCode,
          currencyCode: row.currencyCode,
          timezone: row.timezone,
          defaultLocale: row.defaultLocale,
        };
      },
    },
  };
}
