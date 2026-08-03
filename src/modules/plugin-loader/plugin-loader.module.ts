import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FilesModule } from '../files/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { ShippingEngineModule } from '../shipping-engine/public';
import { TaxEngineModule } from '../tax-engine/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { AdminExtensionsResolver } from './admin-extensions.resolver';
import { ContributionRegistry } from './contribution-registry';
import { PluginStateEntity } from './entities/plugin-state.entity';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginManagementService } from './plugin-management.service';
import { PluginsResolver } from './plugins.resolver';

@Module({
  imports: [
    ConfigModule,
    EventBusModule,
    AuthModule,
    PaymentEngineModule,
    ShippingEngineModule,
    TaxEngineModule,
    FilesModule,
    TypeOrmModule.forFeature([PluginStateEntity]),
  ],
  providers: [
    ContributionRegistry,
    AdminExtensionRegistry,
    PluginLoaderService,
    PluginManagementService,
    AdminExtensionsResolver,
    PluginsResolver,
  ],
  exports: [
    PluginLoaderService,
    PluginManagementService,
    ContributionRegistry,
    AdminExtensionRegistry,
  ],
})
export class PluginLoaderModule {}
