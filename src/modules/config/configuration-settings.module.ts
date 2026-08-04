import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { StoresModule } from '../stores/public';
import { configurationEntities } from './entities';
import { StoreChannelSettingsEventsRegistrar } from './events/store-channel-settings-events.registrar';
import { StoreChannelSettingsResolver } from './store-channel-settings.resolver';
import { StoreChannelSettingsService } from './store-channel-settings.service';
import { StoreCreatedChannelSettingsListener } from './store-created-channel-settings.listener';

/**
 * Store-scoped channel settings.
 * Separate from env ConfigModule to avoid DatabaseModule circular imports.
 */
@Module({
  imports: [AuthModule, StoresModule, TypeOrmModule.forFeature([...configurationEntities])],
  providers: [
    StoreChannelSettingsService,
    StoreChannelSettingsResolver,
    StoreChannelSettingsEventsRegistrar,
    StoreCreatedChannelSettingsListener,
  ],
  exports: [StoreChannelSettingsService, TypeOrmModule],
})
export class ConfigurationSettingsModule {}
