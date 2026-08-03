import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FileEntity } from './entities/file.entity';
import { FilesService } from './files.service';
import { StorageAdapterRegistry } from './storage-adapter.registry';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [StorageAdapterRegistry, FilesService],
  exports: [StorageAdapterRegistry, FilesService, TypeOrmModule],
})
export class FilesModule {}
