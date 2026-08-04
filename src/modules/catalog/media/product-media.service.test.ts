import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductMediaService } from './product-media.service';
import type { ProductMediaEntity } from '../entities/product-media.entity';

describe('ProductMediaService', () => {
  let media: Map<string, ProductMediaEntity>;
  let service: ProductMediaService;
  let getById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    media = new Map();
    getById = vi.fn(async (id: string) =>
      id === 'file-1'
        ? { id: 'file-1', storageKey: 'a.jpg', mimeType: 'image/jpeg', size: '10' }
        : null,
    );

    const mediaRepo = {
      create: vi.fn((data: Partial<ProductMediaEntity>) => ({ ...data }) as ProductMediaEntity),
      save: vi.fn(async (row: ProductMediaEntity) => {
        if (!row.id) {
          row.id = `media-${media.size + 1}`;
          row.createdAt = new Date('2026-08-03T00:00:00Z');
          row.updatedAt = row.createdAt;
        }
        media.set(row.id, { ...row });
        return media.get(row.id)!;
      }),
      find: vi.fn(async ({ where }: { where: { productId: string } }) =>
        [...media.values()]
          .filter((m) => m.productId === where.productId)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      ),
      findOne: vi.fn(async ({ where }: { where: { id: string } }) => media.get(where.id) ?? null),
      delete: vi.fn(async ({ id }: { id: string }) => {
        media.delete(id);
        return { affected: 1 };
      }),
    };

    const productsRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'prod-1' ? { id: 'prod-1' } : null,
      ),
    };

    service = new ProductMediaService(
      mediaRepo as never,
      productsRepo as never,
      { getById } as never,
    );
  });

  it('attaches, updates, lists, and detaches product media via fileId', async () => {
    const attached = await service.attach({
      productId: 'prod-1',
      fileId: 'file-1',
      sortOrder: 1,
      altText: 'Hero',
    });
    expect(attached.fileId).toBe('file-1');
    expect(attached.altText).toBe('Hero');
    expect(getById).toHaveBeenCalledWith('file-1');

    const updated = await service.update(attached.id, {
      sortOrder: 2,
      altText: 'Alt',
    });
    expect(updated.sortOrder).toBe(2);
    expect(updated.altText).toBe('Alt');

    const listed = await service.listByProduct('prod-1');
    expect(listed).toHaveLength(1);

    const detached = await service.detach(attached.id);
    expect(detached.id).toBe(attached.id);
    await expect(service.findById(attached.id)).rejects.toThrow(/not found/);
  });

  it('rejects unknown products and files', async () => {
    await expect(service.attach({ productId: 'missing', fileId: 'file-1' })).rejects.toThrow(
      /Product/,
    );
    await expect(service.attach({ productId: 'prod-1', fileId: 'missing' })).rejects.toThrow(
      /File/,
    );
  });
});
