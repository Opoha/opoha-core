import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AttributeValueEntity } from './attribute-value.entity';

/** Applies to product, variant, or both. */
export type AttributeAppliesTo = 'product' | 'variant' | 'both';

/** Stored value kind (serialized as text on AttributeValue). */
export type AttributeValueType = 'text' | 'number' | 'boolean';

/** OWNER: catalog module — plugins must not alter this table. */
@Entity({ name: 'attribute_definitions' })
export class AttributeDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'value_type', type: 'text', default: 'text' })
  valueType!: AttributeValueType;

  @Column({ name: 'applies_to', type: 'text', default: 'both' })
  appliesTo!: AttributeAppliesTo;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => AttributeValueEntity, (value) => value.definition)
  values!: AttributeValueEntity[];
}
