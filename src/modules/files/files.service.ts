import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FileEntity } from './entities/file.entity';
import { StorageAdapterRegistry } from './storage-adapter.registry';
import type { StorageAdapter } from './storage-adapter';

export type CreateFileMetadataInput = {
  storageKey: string;
  mimeType: string;
  size: number;
  checksum?: string | null;
  createdBy?: string | null;
  pluginId?: string | null;
  storageProvider?: string | null;
};

/**
 * Files abstraction — metadata CRUD only.
 * Blob put/get/delete is deferred to storage plugins via StorageAdapterRegistry.
 */
@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly files: Repository<FileEntity>,
    private readonly storageAdapters: StorageAdapterRegistry,
  ) {}

  register(adapter: StorageAdapter, pluginId = 'core'): void {
    this.storageAdapters.register(pluginId, adapter);
  }

  getAdapter(id: string): StorageAdapter | undefined {
    return this.storageAdapters.get(id);
  }

  listAdapters(): readonly StorageAdapter[] {
    return this.storageAdapters.list(true).map((e) => e.adapter);
  }

  async createMetadata(input: CreateFileMetadataInput): Promise<FileEntity> {
    if (!input.storageKey || input.storageKey.trim().length === 0) {
      throw new Error('storageKey is required');
    }
    if (input.size < 0) {
      throw new Error('size must be non-negative');
    }
    const entity = this.files.create({
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      size: String(input.size),
      checksum: input.checksum ?? null,
      createdBy: input.createdBy ?? null,
      pluginId: input.pluginId ?? null,
      storageProvider: input.storageProvider ?? null,
    });
    return this.files.save(entity);
  }

  async getById(id: string): Promise<FileEntity | null> {
    return this.files.findOne({ where: { id } });
  }

  async deleteMetadata(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundException(`File metadata "${id}" not found`);
    }
    await this.files.remove(existing);
  }
}
