import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { FilesService } from '../../files/public';
import { ProductMediaEntity } from '../entities/product-media.entity';
import { ProductEntity } from '../entities/product.entity';
import type {
  AttachProductMediaInput,
  ProductMediaType,
  UpdateProductMediaInput,
} from './product-media.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toMediaType(row: ProductMediaEntity): ProductMediaType {
  return {
    id: row.id,
    productId: row.productId,
    fileId: row.fileId,
    sortOrder: row.sortOrder,
    altText: row.altText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ProductMediaService {
  constructor(
    @InjectRepository(ProductMediaEntity)
    private readonly media: Repository<ProductMediaEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly filesService: FilesService,
  ) {}

  async listByProduct(productId: string): Promise<ProductMediaType[]> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    const rows = await this.media.find({
      where: { productId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return rows.map(toMediaType);
  }

  async findById(id: string): Promise<ProductMediaType> {
    const row = await this.media.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Product media ${id} not found`);
    }
    return toMediaType(row);
  }

  async attach(input: AttachProductMediaInput): Promise<ProductMediaType> {
    const product = await this.products.findOne({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${input.productId} not found`);
    }
    const file = await this.filesService.getById(input.fileId);
    if (!file) {
      throw new NotFoundException(`File ${input.fileId} not found`);
    }

    const row = this.media.create({
      productId: product.id,
      fileId: file.id,
      sortOrder: input.sortOrder ?? 0,
      altText: input.altText?.trim() || null,
    });
    try {
      const saved = await this.media.save(row);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `File ${input.fileId} is already linked to product ${input.productId}`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateProductMediaInput,
  ): Promise<ProductMediaType> {
    const row = await this.media.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Product media ${id} not found`);
    }
    if (input.sortOrder !== undefined) {
      row.sortOrder = input.sortOrder;
    }
    if (input.altText !== undefined) {
      row.altText = input.altText.trim() || null;
    }
    await this.media.save(row);
    return this.findById(id);
  }

  async detach(id: string): Promise<ProductMediaType> {
    const existing = await this.findById(id);
    await this.media.delete({ id });
    return existing;
  }
}
