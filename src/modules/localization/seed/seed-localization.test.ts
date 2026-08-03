import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALIZATION_SETTINGS } from '../localization.defaults';
import { LOCALIZATION_SETTINGS_KEY } from '../entities/localization-settings.entity';
import {
  seedLocalization,
  type SeedLocalizationStore,
} from './seed-localization';

function createMemoryStore(
  initial?: {
    key: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    defaultLocale: string;
  },
): SeedLocalizationStore & {
  rows: NonNullable<typeof initial>[];
} {
  const rows: NonNullable<typeof initial>[] = initial ? [initial] : [];
  return {
    rows,
    localizationSettings: {
      async findUnique({ where }) {
        return rows.find((r) => r.key === where.key) ?? null;
      },
      async create({ data }) {
        rows.push(data);
        return data;
      },
    },
  };
}

describe('seedLocalization', () => {
  it('creates defaults when missing', async () => {
    const store = createMemoryStore();
    const first = await seedLocalization(store);
    expect(first.created).toBe(true);
    expect(first).toMatchObject({
      key: LOCALIZATION_SETTINGS_KEY,
      ...DEFAULT_LOCALIZATION_SETTINGS,
    });
    expect(store.rows).toHaveLength(1);
  });

  it('is idempotent and does not overwrite existing values', async () => {
    const store = createMemoryStore({
      key: LOCALIZATION_SETTINGS_KEY,
      countryCode: 'TH',
      currencyCode: 'THB',
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th-TH',
    });
    const result = await seedLocalization(store);
    expect(result.created).toBe(false);
    expect(result).toMatchObject({
      countryCode: 'TH',
      currencyCode: 'THB',
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th-TH',
    });
    expect(store.rows).toHaveLength(1);
  });
});
