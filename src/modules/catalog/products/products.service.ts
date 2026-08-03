import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import type { StoreCatalogMode } from '../../config/public';
import { StoreChannelSettingsService } from '../../config/public';
import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import { ProductVariantEntity } from '../entities/product-variant.entity';
import { ProductEntity } from '../entities/product.entity';
import { catalogStoreWhere } from '../store-catalog-scope';
import { CatalogTranslationsService } from '../translations/catalog-translations.service';
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

function isFkViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
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
    storeId: row.storeId ?? null,
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

function normalizeStoreId(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional()
    private readonly channelSettings?: StoreChannelSettingsService,
    @Optional()
    private readonly translations?: CatalogTranslationsService,
  ) {}

  /**
   * List products (Phase 5 B-04 / C-02).
   * When `storeId` is set:
   * - `shared` → shared (`storeId` null) ∪ store-owned
   * - `isolated` → store-owned only
   * Omit `catalogMode` to resolve from store channel settings (default shared).
   * Omit `storeId` for admin/global listing.
   * Optional `locale` overlays translated name/slug/description.
   */
  async findAll(
    storeId?: string | null,
    catalogMode?: StoreCatalogMode | null,
    locale?: string | null,
  ): Promise<ProductType[]> {
    const scope = normalizeStoreId(storeId);
    const mode = await this.resolveCatalogMode(scope, catalogMode);
    const rows = await this.products.find({
      where: catalogStoreWhere<ProductEntity>(scope, mode),
      order: { createdAt: 'ASC' },
      relations: { variants: true },
    });
    const products = rows.map(toProductType);
    if (this.translations) {
      return this.translations.applyProductLocaleMany(products, locale);
    }
    return products;
  }

  private async resolveCatalogMode(
    storeId: string | null | undefined,
    catalogMode?: StoreCatalogMode | null,
  ): Promise<StoreCatalogMode> {
    if (catalogMode === 'shared' || catalogMode === 'isolated') {
      return catalogMode;
    }
    if (storeId && this.channelSettings) {
      const settings = await this.channelSettings.getForStore(storeId);
      return settings.catalogMode;
    }
    return 'shared';
  }

  async findById(
    id: string,
    locale?: string | null,
  ): Promise<ProductType> {
    const row = await this.products.findOne({
      where: { id },
      relations: { variants: true },
    });
    if (!row) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    const product = toProductType(row);
    if (this.translations) {
      return this.translations.applyProductLocale(product, locale);
    }
    return product;
  }

  async create(input: CreateProductInput): Promise<ProductType> {
    const storeId = normalizeStoreId(input.storeId) ?? null;
    const product = this.products.create({
      name: input.name.trim(),
      slug: input.slug.trim(),
      description: input.description?.trim() ?? null,
      isActive: input.isActive ?? true,
      storeId,
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
      if (isFkViolation(error)) {
        throw new BadRequestException(`Store ${storeId} not found`);
      }
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
    if (input.storeId !== undefined) {
      row.storeId = normalizeStoreId(input.storeId) ?? null;
    }
    try {
      await this.products.save(row);
      const updated = await this.findById(id);
      await this.publishProductEvent(CoreEventName.ProductUpdated, updated);
      return updated;
    } catch (error) {
      if (isFkViolation(error)) {
        throw new BadRequestException(`Store ${row.storeId} not found`);
      }
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
        storeId: product.storeId,
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
