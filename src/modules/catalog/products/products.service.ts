import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import { ProductVariantEntity } from '../entities/product-variant.entity';
import { ProductEntity } from '../entities/product.entity';
import type {
  CreateProductInput,
  CreateProductVariantInput,
  ProductType,
  ProductVariantType,
  UpdateProductInput,
} from './product.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toVariantType(row: ProductVariantEntity): ProductVariantType {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    priceMinor: String(row.priceMinor),
    currencyCode: row.currencyCode,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toProductType(row: ProductEntity): ProductType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    variants: (row.variants ?? []).map(toVariantType),
  };
}

function assertMinorUnits(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(
      `priceMinor must be a non-negative integer string, got "${value}"`,
    );
  }
  return value;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findAll(): Promise<ProductType[]> {
    const rows = await this.products.find({
      order: { createdAt: 'ASC' },
      relations: { variants: true },
    });
    return rows.map(toProductType);
  }

  async findById(id: string): Promise<ProductType> {
    const row = await this.products.findOne({
      where: { id },
      relations: { variants: true },
    });
    if (!row) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return toProductType(row);
  }

  async create(input: CreateProductInput): Promise<ProductType> {
    const product = this.products.create({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      isActive: input.isActive ?? true,
    });

    try {
      const saved = await this.products.save(product);
      if (input.variants?.length) {
        await this.createVariants(saved.id, input.variants);
      }
      const created = await this.findById(saved.id);
      await this.publishProductEvent(CoreEventName.ProductCreated, created);
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Product slug or variant SKU already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateProductInput): Promise<ProductType> {
    const row = await this.products.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    if (input.name !== undefined) {
      row.name = input.name.trim();
    }
    if (input.slug !== undefined) {
      row.slug = input.slug.trim();
    }
    if (input.description !== undefined) {
      row.description = input.description.trim() || null;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    try {
      await this.products.save(row);
      const updated = await this.findById(id);
      await this.publishProductEvent(CoreEventName.ProductUpdated, updated);
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Product slug "${row.slug}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<ProductType> {
    const existing = await this.findById(id);
    await this.products.delete({ id });
    if (this.eventBus) {
      await this.eventBus.publish({
        eventName: CoreEventName.ProductDeleted,
        aggregateType: 'product',
        aggregateId: existing.id,
        data: {
          productId: existing.id,
          slug: existing.slug,
        },
      });
    }
    return existing;
  }

  private async publishProductEvent(
    eventName:
      | typeof CoreEventName.ProductCreated
      | typeof CoreEventName.ProductUpdated,
    product: ProductType,
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }
    await this.eventBus.publish({
      eventName,
      aggregateType: 'product',
      aggregateId: product.id,
      data: {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        isActive: product.isActive,
      },
    });
  }

  private async createVariants(
    productId: string,
    inputs: CreateProductVariantInput[],
  ): Promise<void> {
    const rows = inputs.map((input) =>
      this.variants.create({
        productId,
        sku: input.sku.trim(),
        name: input.name?.trim() ?? null,
        priceMinor: assertMinorUnits(input.priceMinor),
        currencyCode: (input.currencyCode ?? 'USD').trim().toUpperCase(),
        isActive: input.isActive ?? true,
      }),
    );
    await this.variants.save(rows);
  }
}
