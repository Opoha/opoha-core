import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Catalog visibility preference for a store channel. */
export type StoreCatalogMode = 'shared' | 'isolated';

/**
 * Per-store channel configuration.
 * OWNER: configuration module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 */
@Entity({ name: 'store_channel_settings' })
export class StoreChannelSettingsEntity {
  /** Store channel id (PK). FK to `stores.id`. */
  @PrimaryColumn({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  /** IANA timezone for the channel. */
  @Column({ type: 'text', default: 'UTC' })
  timezone!: string;

  /** ISO 3166-1 alpha-2 country code. */
  @Column({ name: 'country_code', type: 'text', default: 'US' })
  countryCode!: string;

  /**
   * Catalog policy preference:
   * - `shared` — channel expects shared + owned catalog visibility
   * - `isolated` — channel prefers store-owned catalog only (enforced at write/list layers)
   */
  @Column({ name: 'catalog_mode', type: 'text', default: 'shared' })
  catalogMode!: StoreCatalogMode;

  /**
   * Extensible opaque JSON bag for additional channel keys
   * (future display currency overrides, etc. without schema churn).
   */
  @Column({ name: 'settings_json', type: 'jsonb', default: {} })
  settingsJson!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
