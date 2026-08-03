import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { storeEntities } from './entities';
import { StoreEventsRegistrar } from './events/store-events.registrar';
import { StoreResolver } from './store.resolver';
import { StoreService } from './store.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...storeEntities])],
  providers: [StoreService, StoreResolver, StoreEventsRegistrar],
  exports: [StoreService, TypeOrmModule],
})
export class StoresModule {}
