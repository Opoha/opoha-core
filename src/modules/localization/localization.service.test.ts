import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALIZATION_SETTINGS_KEY } from './entities/localization-settings.entity';
import { LocalizationService } from './localization.service';

type SettingsRow = {
  key: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  defaultLocale: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('LocalizationService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let store: SettingsRow[];
  let service: LocalizationService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    store = [];
    repo = {
      findOne: vi.fn(async ({ where }: { where: { key: string } }) => {
        return store.find((r) => r.key === where.key) ?? null;
      }),
      create: vi.fn((data: Partial<SettingsRow>) => ({
        key: LOCALIZATION_SETTINGS_KEY,
        countryCode: 'US',
        currencyCode: 'USD',
        timezone: 'UTC',
        defaultLocale: 'en-US',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: SettingsRow) => {
        const idx = store.findIndex((r) => r.key === row.key);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          store[idx] = saved;
        } else {
          store.push(saved);
        }
        return saved;
      }),
    };
    service = new LocalizationService(repo as never);
  });

  it('get creates default settings when missing', async () => {
    const result = await service.get();
    expect(result).toMatchObject({
      countryCode: 'US',
      currencyCode: 'USD',
      timezone: 'UTC',
      defaultLocale: 'en-US',
    });
    expect(store).toHaveLength(1);
  });

  it('update persists valid fields', async () => {
    await service.get();
    const updated = await service.update({
      countryCode: 'th',
      currencyCode: 'thb',
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th-TH',
    });
    expect(updated).toMatchObject({
      countryCode: 'TH',
      currencyCode: 'THB',
      timezone: 'Asia/Bangkok',
      defaultLocale: 'th-TH',
    });
  });

  it('rejects invalid country / currency / timezone / locale', async () => {
    await service.get();
    await expect(service.update({ countryCode: 'USA' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update({ currencyCode: 'US' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update({ timezone: 'Not/AZone' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({ defaultLocale: 'ENGLISH' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
