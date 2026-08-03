import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { localizationEntities } from './entities';
import { LocalizationResolver } from './localization.resolver';
import { LocalizationService } from './localization.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...localizationEntities])],
  providers: [LocalizationService, LocalizationResolver],
  exports: [LocalizationService, TypeOrmModule],
})
export class LocalizationModule {}
