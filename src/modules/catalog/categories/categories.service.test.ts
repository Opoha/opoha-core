import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoriesService } from './categories.service';
import type { CategoryEntity } from '../entities/category.entity';

function createCategoryRepo(store: Map<string, CategoryEntity>) {
  return {
    create: vi.fn((data: Partial<CategoryEntity>) => ({ ...data }) as CategoryEntity),
    save: vi.fn(async (row: CategoryEntity) => {
      if (!row.id) {
        row.id = `cat-${store.size + 1}`;
        row.createdAt = new Date('2026-08-03T00:00:00Z');
        row.updatedAt = row.createdAt;
      }
      store.set(row.id, { ...row });
      return store.get(row.id)!;
    }),
    find: vi.fn(async () => [...store.values()]),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
      return store.get(where.id) ?? null;
    }),
    delete: vi.fn(async ({ id }: { id: string }) => {
      store.delete(id);
      return { affected: 1 };
    }),
  };
}

describe('CategoriesService', () => {
  let store: Map<string, CategoryEntity>;
  let service: CategoriesService;

  beforeEach(() => {
    store = new Map();
    service = new CategoriesService(createCategoryRepo(store) as never);
  });

  it('creates nested categories and rejects self-parent', async () => {
    const root = await service.create({ name: 'Apparel', slug: 'apparel' });
    const child = await service.create({
      name: 'Tees',
      slug: 'tees',
      parentId: root.id,
    });
    expect(child.parentId).toBe(root.id);

    await expect(
      service.update(root.id, { parentId: root.id }),
    ).rejects.toThrow(/own parent/);
  });

  it('rejects cycles when reparenting', async () => {
    const root = await service.create({ name: 'Root', slug: 'root' });
    const child = await service.create({
      name: 'Child',
      slug: 'child',
      parentId: root.id,
    });
    await expect(
      service.update(root.id, { parentId: child.id }),
    ).rejects.toThrow(/cycle/);
  });

  it('updates and deletes categories', async () => {
    const created = await service.create({ name: 'Gear', slug: 'gear' });
    const updated = await service.update(created.id, { name: 'Outdoor' });
    expect(updated.name).toBe('Outdoor');

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toThrow(/not found/);
  });
});
