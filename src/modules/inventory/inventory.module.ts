import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { inventoryEntities } from './entities';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...inventoryEntities])],
  providers: [InventoryService, InventoryResolver],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}
