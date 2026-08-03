import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { PluginLoaderService } from './plugin-loader.service';

@Module({
  imports: [ConfigModule],
  providers: [PluginLoaderService],
  exports: [PluginLoaderService],
})
export class PluginLoaderModule {}
