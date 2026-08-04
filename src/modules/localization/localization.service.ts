import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DEFAULT_LOCALIZATION_SETTINGS } from './localization.defaults';
import {
  LOCALIZATION_SETTINGS_KEY,
  LocalizationSettingsEntity,
} from './entities/localization-settings.entity';
import type {
  LocalizationSettingsType,
  UpdateLocalizationSettingsInput,
} from './localization.types';

const COUNTRY_RE = /^[A-Z]{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const LOCALE_RE = /^[a-z]{2}(-[A-Za-z0-9]+)*$/;

function assertCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!COUNTRY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid countryCode "${value}" (expected ISO 3166-1 alpha-2)`);
  }
  return normalized;
}

function assertCurrencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid currencyCode "${value}" (expected ISO 4217)`);
  }
  return normalized;
}

function assertTimezone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('timezone must not be empty');
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
  } catch {
    throw new BadRequestException(`Invalid timezone "${value}" (expected IANA identifier)`);
  }
  return trimmed;
}

function assertLocale(value: string): string {
  const trimmed = value.trim();
  if (!LOCALE_RE.test(trimmed)) {
    throw new BadRequestException(
      `Invalid defaultLocale "${value}" (expected BCP 47-like tag, e.g. en-US)`,
    );
  }
  return trimmed;
}

function toType(row: LocalizationSettingsEntity): LocalizationSettingsType {
  return {
    countryCode: row.countryCode,
    currencyCode: row.currencyCode,
    timezone: row.timezone,
    defaultLocale: row.defaultLocale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class LocalizationService {
  constructor(
    @InjectRepository(LocalizationSettingsEntity)
    private readonly settings: Repository<LocalizationSettingsEntity>,
  ) {}

  /** Read singleton settings, creating defaults when missing. */
  async get(): Promise<LocalizationSettingsType> {
    const row = await this.ensureRow();
    return toType(row);
  }

  async update(input: UpdateLocalizationSettingsInput): Promise<LocalizationSettingsType> {
    const row = await this.ensureRow();
    if (input.countryCode !== undefined) {
      row.countryCode = assertCountryCode(input.countryCode);
    }
    if (input.currencyCode !== undefined) {
      row.currencyCode = assertCurrencyCode(input.currencyCode);
    }
    if (input.timezone !== undefined) {
      row.timezone = assertTimezone(input.timezone);
    }
    if (input.defaultLocale !== undefined) {
      row.defaultLocale = assertLocale(input.defaultLocale);
    }
    const saved = await this.settings.save(row);
    return toType(saved);
  }

  private async ensureRow(): Promise<LocalizationSettingsEntity> {
    const existing = await this.settings.findOne({
      where: { key: LOCALIZATION_SETTINGS_KEY },
    });
    if (existing) {
      return existing;
    }
    const created = this.settings.create({
      key: LOCALIZATION_SETTINGS_KEY,
      countryCode: DEFAULT_LOCALIZATION_SETTINGS.countryCode,
      currencyCode: DEFAULT_LOCALIZATION_SETTINGS.currencyCode,
      timezone: DEFAULT_LOCALIZATION_SETTINGS.timezone,
      defaultLocale: DEFAULT_LOCALIZATION_SETTINGS.defaultLocale,
    });
    return this.settings.save(created);
  }
}
