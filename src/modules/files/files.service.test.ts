import { describe, expect, it } from 'vitest';

import { FilesService } from './files.service';
import { StorageAdapterRegistry } from './storage-adapter.registry';
import type { FileEntity } from './entities/file.entity';

function createService() {
  const store = new Map<string, FileEntity>();
  let seq = 0;
  const files = {
    create: (data: Partial<FileEntity>) =>
      ({
        id: '',
        checksum: null,
        createdBy: null,
        pluginId: null,
        storageProvider: null,
        createdAt: new Date(),
        ...data,
      }) as FileEntity,
    save: async (entity: FileEntity) => {
      if (!entity.id) {
        entity.id = `file-${++seq}`;
      }
      store.set(entity.id, entity);
      return entity;
    },
    findOne: async ({ where }: { where: { id: string } }) =>
      store.get(where.id) ?? null,
    remove: async (entity: FileEntity) => {
      store.delete(entity.id);
      return entity;
    },
  };
  const registry = new StorageAdapterRegistry();
  const service = new FilesService(files as never, registry);
  return { service, registry, store };
}

describe('StorageAdapterRegistry', () => {
  it('register / get / list adapters', () => {
    const registry = new StorageAdapterRegistry();
    registry.register('localfs-plugin', {
      code: 'localfs',
      async put({ key, body }) {
        return { key, size: body.byteLength };
      },
      async get() {
        return new Uint8Array();
      },
      async delete() {},
    });
    expect(registry.get('localfs')?.code).toBe('localfs');
    expect(registry.list(true)).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    const registry = new StorageAdapterRegistry();
    registry.register('a', {
      code: 'localfs',
      async put({ key, body }) {
        return { key, size: body.byteLength };
      },
      async get() {
        return new Uint8Array();
      },
      async delete() {},
    });
    expect(() =>
      registry.register('b', {
        code: 'localfs',
        async put({ key, body }) {
          return { key, size: body.byteLength };
        },
        async get() {
          return new Uint8Array();
        },
        async delete() {},
      }),
    ).toThrow(/conflict/);
  });
});

describe('FilesService', () => {
  it('creates, gets, and deletes metadata', async () => {
    const { service } = createService();
    const created = await service.createMetadata({
      storageKey: 'uploads/a.png',
      mimeType: 'image/png',
      size: 42,
      checksum: 'abc',
      storageProvider: 'localfs',
      pluginId: 'storage-localfs',
    });
    expect(created.id).toMatch(/^file-/);
    expect(created.size).toBe('42');

    const found = await service.getById(created.id);
    expect(found?.storageKey).toBe('uploads/a.png');

    await service.deleteMetadata(created.id);
    expect(await service.getById(created.id)).toBeNull();
  });

  it('registers storage adapters via service', () => {
    const { service } = createService();
    service.register({
      code: 'localfs',
      async put({ key, body }) {
        return { key, size: body.byteLength };
      },
      async get() {
        return new Uint8Array();
      },
      async delete() {},
    });
    expect(service.getAdapter('localfs')?.code).toBe('localfs');
    expect(service.listAdapters()).toHaveLength(1);
  });

  it('throws when deleting missing metadata', async () => {
    const { service } = createService();
    await expect(service.deleteMetadata('missing')).rejects.toThrow(/not found/);
  });

  it('rejects empty storageKey', async () => {
    const { service } = createService();
    await expect(
      service.createMetadata({
        storageKey: '  ',
        mimeType: 'text/plain',
        size: 1,
      }),
    ).rejects.toThrow(/storageKey/);
  });
});
