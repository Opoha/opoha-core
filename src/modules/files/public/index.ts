/**
 * Public files module surface.
 */
export { FilesModule } from '../files.module';
export { FilesService } from '../files.service';
export type { CreateFileMetadataInput } from '../files.service';
export { StorageAdapterRegistry } from '../storage-adapter.registry';
export { FileEntity } from '../entities/file.entity';
export type {
  StorageAdapter,
  StoragePutInput,
  StoragePutResult,
  RegisteredStorageAdapter,
} from '../storage-adapter';
