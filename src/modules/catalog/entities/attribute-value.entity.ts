import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AttributeDefinitionEntity } from './attribute-definition.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';

/**
 * Attribute value attached to either a product or a variant (exactly one).
 * OWNER: catalog module — plugins must not alter this table.
 */
@Entity({ name: 'attribute_values' })
export class AttributeValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attribute_definition_id', type: 'uuid' })
  attributeDefinitionId!: string;

  @ManyToOne(() => AttributeDefinitionEntity, (def) => def.values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_definition_id' })
  definition!: AttributeDefinitionEntity;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity | null;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne(() => ProductVariantEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariantEntity | null;

  /** Serialized value (text / number / boolean as string). */
  @Column({ type: 'text' })
  value!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
