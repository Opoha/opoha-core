import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import {
  AttributeDefinitionEntity,
  type AttributeAppliesTo,
  type AttributeValueType as AttrValueKind,
} from '../entities/attribute-definition.entity';
import { AttributeValueEntity } from '../entities/attribute-value.entity';
import { ProductVariantEntity } from '../entities/product-variant.entity';
import { ProductEntity } from '../entities/product.entity';
import {
  AttributeAppliesToEnum,
  AttributeValueTypeEnum,
  type AttributeDefinitionType,
  type AttributeValueType,
  type CreateAttributeDefinitionInput,
  type SetProductAttributeInput,
  type SetVariantAttributeInput,
  type UpdateAttributeDefinitionInput,
} from './attribute.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toDefinitionType(row: AttributeDefinitionEntity): AttributeDefinitionType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    valueType: row.valueType as AttributeValueTypeEnum,
    appliesTo: row.appliesTo as AttributeAppliesToEnum,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toValueType(row: AttributeValueEntity): AttributeValueType {
  return {
    id: row.id,
    attributeDefinitionId: row.attributeDefinitionId,
    productId: row.productId,
    variantId: row.variantId,
    value: row.value,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeValue(kind: AttrValueKind, raw: string): string {
  const trimmed = raw.trim();
  if (kind === 'boolean') {
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === '1') return 'true';
    if (lower === 'false' || lower === '0') return 'false';
    throw new BadRequestException(`Boolean attribute value must be true/false, got "${raw}"`);
  }
  if (kind === 'number') {
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new BadRequestException(`Number attribute value must be numeric, got "${raw}"`);
    }
    return trimmed;
  }
  if (trimmed.length === 0) {
    throw new BadRequestException('Attribute value must not be empty');
  }
  return trimmed;
}

function assertAppliesTo(appliesTo: AttributeAppliesTo, target: 'product' | 'variant'): void {
  if (appliesTo === 'both') return;
  if (appliesTo !== target) {
    throw new BadRequestException(`Attribute applies to ${appliesTo}, not ${target}`);
  }
}

@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(AttributeDefinitionEntity)
    private readonly definitions: Repository<AttributeDefinitionEntity>,
    @InjectRepository(AttributeValueEntity)
    private readonly values: Repository<AttributeValueEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
  ) {}

  async findAllDefinitions(): Promise<AttributeDefinitionType[]> {
    const rows = await this.definitions.find({ order: { createdAt: 'ASC' } });
    return rows.map(toDefinitionType);
  }

  async findDefinitionById(id: string): Promise<AttributeDefinitionType> {
    const row = await this.definitions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Attribute definition ${id} not found`);
    }
    return toDefinitionType(row);
  }

  async createDefinition(input: CreateAttributeDefinitionInput): Promise<AttributeDefinitionType> {
    const row = this.definitions.create({
      code: input.code.trim(),
      name: input.name.trim(),
      valueType: (input.valueType ?? AttributeValueTypeEnum.text) as AttrValueKind,
      appliesTo: (input.appliesTo ?? AttributeAppliesToEnum.both) as AttributeAppliesTo,
      isActive: input.isActive ?? true,
    });
    try {
      const saved = await this.definitions.save(row);
      return this.findDefinitionById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Attribute code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async updateDefinition(
    id: string,
    input: UpdateAttributeDefinitionInput,
  ): Promise<AttributeDefinitionType> {
    const row = await this.definitions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Attribute definition ${id} not found`);
    }
    if (input.code !== undefined) row.code = input.code.trim();
    if (input.name !== undefined) row.name = input.name.trim();
    if (input.valueType !== undefined) {
      row.valueType = input.valueType as AttrValueKind;
    }
    if (input.appliesTo !== undefined) {
      row.appliesTo = input.appliesTo as AttributeAppliesTo;
    }
    if (input.isActive !== undefined) row.isActive = input.isActive;
    try {
      await this.definitions.save(row);
      return this.findDefinitionById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Attribute code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async removeDefinition(id: string): Promise<AttributeDefinitionType> {
    const existing = await this.findDefinitionById(id);
    await this.definitions.delete({ id });
    return existing;
  }

  async listProductAttributes(productId: string): Promise<AttributeValueType[]> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    const rows = await this.values.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toValueType);
  }

  async listVariantAttributes(variantId: string): Promise<AttributeValueType[]> {
    const variant = await this.variants.findOne({ where: { id: variantId } });
    if (!variant) {
      throw new NotFoundException(`Variant ${variantId} not found`);
    }
    const rows = await this.values.find({
      where: { variantId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toValueType);
  }

  async setProductAttribute(input: SetProductAttributeInput): Promise<AttributeValueType> {
    const product = await this.products.findOne({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${input.productId} not found`);
    }
    const def = await this.definitions.findOne({
      where: { id: input.attributeDefinitionId },
    });
    if (!def) {
      throw new NotFoundException(`Attribute definition ${input.attributeDefinitionId} not found`);
    }
    assertAppliesTo(def.appliesTo, 'product');
    const value = normalizeValue(def.valueType, input.value);

    let row = await this.values.findOne({
      where: {
        attributeDefinitionId: def.id,
        productId: product.id,
      },
    });
    if (row) {
      row.value = value;
    } else {
      row = this.values.create({
        attributeDefinitionId: def.id,
        productId: product.id,
        variantId: null,
        value,
      });
    }
    try {
      const saved = await this.values.save(row);
      return toValueType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Attribute already set on this product');
      }
      throw error;
    }
  }

  async setVariantAttribute(input: SetVariantAttributeInput): Promise<AttributeValueType> {
    const variant = await this.variants.findOne({
      where: { id: input.variantId },
    });
    if (!variant) {
      throw new NotFoundException(`Variant ${input.variantId} not found`);
    }
    const def = await this.definitions.findOne({
      where: { id: input.attributeDefinitionId },
    });
    if (!def) {
      throw new NotFoundException(`Attribute definition ${input.attributeDefinitionId} not found`);
    }
    assertAppliesTo(def.appliesTo, 'variant');
    const value = normalizeValue(def.valueType, input.value);

    let row = await this.values.findOne({
      where: {
        attributeDefinitionId: def.id,
        variantId: variant.id,
      },
    });
    if (row) {
      row.value = value;
    } else {
      row = this.values.create({
        attributeDefinitionId: def.id,
        productId: null,
        variantId: variant.id,
        value,
      });
    }
    try {
      const saved = await this.values.save(row);
      return toValueType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Attribute already set on this variant');
      }
      throw error;
    }
  }

  async removeAttributeValue(id: string): Promise<AttributeValueType> {
    const row = await this.values.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Attribute value ${id} not found`);
    }
    const existing = toValueType(row);
    await this.values.delete({ id });
    return existing;
  }
}
