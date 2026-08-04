import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { ProductEntity } from '../catalog/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { VendorEntity } from './entities/vendor.entity';
import type {
  AssignProductVendorInput,
  CreateVendorInput,
  UpdateVendorInput,
  VendorType,
} from './vendor.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toVendorType(row: VendorEntity): VendorType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    storeId: row.storeId,
    commissionBps: row.commissionBps,
    isActive: row.isActive,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeStoreId(value: string | null | undefined): string | null | undefined {
  return normalizeOptionalText(value);
}

function assertCommissionBps(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    throw new BadRequestException('commissionBps must be an integer between 0 and 10000');
  }
  return value;
}

@Injectable()
export class VendorService {
  constructor(
    @InjectRepository(VendorEntity)
    private readonly vendors: Repository<VendorEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(storeId?: string | null): Promise<VendorType[]> {
    const scope = normalizeStoreId(storeId);
    const rows = await this.vendors.find({
      where: scope ? { storeId: scope } : undefined,
      order: { code: 'ASC' },
    });
    return rows.map(toVendorType);
  }

  async findById(id: string): Promise<VendorType> {
    const row = await this.vendors.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }
    return toVendorType(row);
  }

  async findByCode(code: string): Promise<VendorType> {
    const row = await this.vendors.findOne({
      where: { code: code.trim() },
    });
    if (!row) {
      throw new NotFoundException(`Vendor code "${code}" not found`);
    }
    return toVendorType(row);
  }

  async create(input: CreateVendorInput): Promise<VendorType> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const storeId = normalizeStoreId(input.storeId) ?? null;
    const commissionBps = assertCommissionBps(input.commissionBps);

    try {
      const saved = await this.vendors.save(
        this.vendors.create({
          code,
          name,
          description: normalizeOptionalText(input.description) ?? null,
          storeId,
          commissionBps,
          isActive: input.isActive ?? true,
          email: normalizeOptionalText(input.email) ?? null,
        }),
      );

      await this.eventBus.publish({
        eventName: CoreEventName.VendorUpdated,
        aggregateType: 'vendor',
        aggregateId: saved.id,
        data: {
          vendorId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          action: 'created',
        },
      });

      return toVendorType(saved);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(`Store ${storeId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Vendor code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateVendorInput): Promise<VendorType> {
    const existing = await this.vendors.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) {
        throw new BadRequestException('code cannot be empty');
      }
      existing.code = code;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }
      existing.name = name;
    }
    if (input.description !== undefined) {
      existing.description = normalizeOptionalText(input.description) ?? null;
    }
    if (input.storeId !== undefined) {
      existing.storeId = normalizeStoreId(input.storeId) ?? null;
    }
    if (input.commissionBps !== undefined) {
      existing.commissionBps = assertCommissionBps(input.commissionBps);
    }
    if (input.isActive !== undefined) {
      existing.isActive = input.isActive;
    }
    if (input.email !== undefined) {
      existing.email = normalizeOptionalText(input.email) ?? null;
    }

    try {
      const saved = await this.vendors.save(existing);

      await this.eventBus.publish({
        eventName: CoreEventName.VendorUpdated,
        aggregateType: 'vendor',
        aggregateId: saved.id,
        data: {
          vendorId: saved.id,
          code: saved.code,
          name: saved.name,
          isActive: saved.isActive,
          action: 'updated',
        },
      });

      return toVendorType(saved);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(`Store ${existing.storeId} not found`);
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Vendor code "${existing.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<VendorType> {
    const existing = await this.vendors.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Vendor ${id} not found`);
    }

    const linked = await this.products.count({ where: { vendorId: id } });
    if (linked > 0) {
      throw new BadRequestException(
        `Cannot delete vendor ${id}: ${linked} product(s) still reference it`,
      );
    }

    try {
      await this.vendors.delete({ id });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(`Cannot delete vendor ${id}: orders still reference it`);
      }
      throw error;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.VendorUpdated,
      aggregateType: 'vendor',
      aggregateId: existing.id,
      data: {
        vendorId: existing.id,
        code: existing.code,
        name: existing.name,
        isActive: existing.isActive,
        action: 'deleted',
      },
    });

    return toVendorType(existing);
  }

  /**
 * Associate a catalog product with a marketplace vendor.
   * Clears association when vendorId is null.
   */
  async assignProductVendor(
    input: AssignProductVendorInput,
  ): Promise<{ productId: string; vendorId: string | null }> {
    const productId = input.productId.trim();
    if (!productId) {
      throw new BadRequestException('productId is required');
    }

    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const vendorId =
      input.vendorId === null || input.vendorId === undefined
        ? null
        : input.vendorId.trim() || null;

    if (vendorId) {
      const vendor = await this.vendors.findOne({ where: { id: vendorId } });
      if (!vendor) {
        throw new NotFoundException(`Vendor ${vendorId} not found`);
      }
      if (!vendor.isActive) {
        throw new BadRequestException(`Vendor ${vendorId} is inactive`);
      }
    }

    product.vendorId = vendorId;
    try {
      await this.products.save(product);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(`Vendor ${vendorId} not found`);
      }
      throw error;
    }

    return { productId: product.id, vendorId: product.vendorId };
  }

  async listProductsForVendor(vendorId: string): Promise<ProductEntity[]> {
    await this.findById(vendorId);
    return this.products.find({
      where: { vendorId },
      order: { slug: 'ASC' },
    });
  }
}
