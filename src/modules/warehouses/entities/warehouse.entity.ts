import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER: warehouses module — plugins must not alter this table. */
@Entity({ name: 'warehouses' })
export class WarehouseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable merchant-facing code (e.g. DEFAULT, NYC-01). */
  @Index('warehouses_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** When true, used as fallback for single-pool / unspecified location ops. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'address_line1', type: 'text', nullable: true })
  addressLine1!: string | null;

  @Column({ name: 'address_line2', type: 'text', nullable: true })
  addressLine2!: string | null;

  @Column({ type: 'text', nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  province!: string | null;

  @Column({ name: 'postal_code', type: 'text', nullable: true })
  postalCode!: string | null;

  @Column({ name: 'country_code', type: 'text', nullable: true })
  countryCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
