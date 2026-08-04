import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Fixed singleton key for deployment localization settings. */
export const LOCALIZATION_SETTINGS_KEY = 'default' as const;

/** OWNER: localization module — plugins must not alter this table. */
@Entity({ name: 'localization_settings' })
export class LocalizationSettingsEntity {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  /** ISO 3166-1 alpha-2 country code (single-country deployment). */
  @Column({ name: 'country_code', type: 'text' })
  countryCode!: string;

  /** ISO 4217 currency code (single currency for Phase 1). */
  @Column({ name: 'currency_code', type: 'text' })
  currencyCode!: string;

  /** IANA timezone identifier. */
  @Column({ type: 'text' })
  timezone!: string;

  /** Default BCP 47 locale (language foundation; full i18n in Phase 5). */
  @Column({ name: 'default_locale', type: 'text' })
  defaultLocale!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
