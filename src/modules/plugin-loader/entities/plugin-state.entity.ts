import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * OWNER: plugin-loader — durable enable/disable + opaque admin config (/ ADR-0010).
 * Plugin-owned domain tables remain in plugin packages (ADR-0005).
 */
@Entity({ name: 'plugin_states' })
export class PluginStateEntity {
  @PrimaryColumn({ name: 'plugin_id', type: 'text' })
  pluginId!: string;

  /** Whether the plugin should be enabled after boot. */
  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /**
   * Opaque JSON object string for admin configure (no secrets in logs).
   * Plugin-specific validated settings may live in plugin-owned tables.
   */
  @Column({ name: 'config_json', type: 'text', nullable: true })
  configJson!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
