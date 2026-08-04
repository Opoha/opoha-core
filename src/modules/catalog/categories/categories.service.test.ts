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
  let repo: ReturnType<typeof createCategoryRepo>;

  beforeEach(() => {
    store = new Map();
    repo = createCategoryRepo(store);
    repo.find = vi.fn(async (opts?: { where?: unknown }) => {
      let rows = [...store.values()];
      const where = opts?.where;
      const clauses = Array.isArray(where) ? where : where ? [where] : [];
      if (clauses.length > 0) {
        rows = rows.filter((row) => {
          const sid = row.storeId ?? null;
          return clauses.some((clause: { storeId?: unknown }) => {
            const op = clause.storeId;
            if (
              typeof op === 'object' &&
              op !== null &&
              'type' in op &&
              (op as { type: string }).type === 'isNull'
            ) {
              return sid === null;
            }
            return sid === op;
          });
        });
      }
      return rows;
    });
    service = new CategoriesService(repo as never);
  });

  it('creates nested categories and rejects self-parent', async () => {
    const root = await service.create({ name: 'Apparel', slug: 'apparel' });
    expect(root.storeId).toBeNull();
    const child = await service.create({
      name: 'Tees',
      slug: 'tees',
      parentId: root.id,
    });
    expect(child.parentId).toBe(root.id);

    await expect(service.update(root.id, { parentId: root.id })).rejects.toThrow(/own parent/);
  });

  it('scopes findAll to shared + store-owned for a store', async () => {
    await service.create({ name: 'Shared', slug: 'shared' });
    await service.create({
      name: 'A only',
      slug: 'a-only',
      storeId: 'store-a',
    });
    await service.create({
      name: 'B only',
      slug: 'b-only',
      storeId: 'store-b',
    });

    const forA = await service.findAll('store-a');
    expect(forA.map((c) => c.slug).sort()).toEqual(['a-only', 'shared']);
  });

  it('scopes findAll to store-owned only when catalogMode is isolated', async () => {
    await service.create({ name: 'Shared', slug: 'shared' });
    await service.create({
      name: 'A only',
      slug: 'a-only',
      storeId: 'store-a',
    });
    await service.create({
      name: 'B only',
      slug: 'b-only',
      storeId: 'store-b',
    });

    const forA = await service.findAll('store-a', 'isolated');
    expect(forA.map((c) => c.slug)).toEqual(['a-only']);
  });

  it('rejects cycles when reparenting', async () => {
    const root = await service.create({ name: 'Root', slug: 'root' });
    const child = await service.create({
      name: 'Child',
      slug: 'child',
      parentId: root.id,
    });
    await expect(service.update(root.id, { parentId: child.id })).rejects.toThrow(/cycle/);
  });

  it('updates and deletes categories', async () => {
    const created = await service.create({ name: 'Gear', slug: 'gear' });
    const updated = await service.update(created.id, {
      name: 'Outdoor',
      storeId: 'store-a',
    });
    expect(updated.name).toBe('Outdoor');
    expect(updated.storeId).toBe('store-a');

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toThrow(/not found/);
  });
});
