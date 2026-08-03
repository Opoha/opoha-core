import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FilesModule } from '../files/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { ShippingEngineModule } from '../shipping-engine/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { AdminExtensionsResolver } from './admin-extensions.resolver';
import { ContributionRegistry } from './contribution-registry';
import { PluginLoaderService } from './plugin-loader.service';

@Module({
  imports: [
    ConfigModule,
    EventBusModule,
    AuthModule,
    PaymentEngineModule,
    ShippingEngineModule,
    FilesModule,
  ],
  providers: [
    ContributionRegistry,
    AdminExtensionRegistry,
    PluginLoaderService,
    AdminExtensionsResolver,
  ],
  exports: [
    PluginLoaderService,
    ContributionRegistry,
    AdminExtensionRegistry,
  ],
})
export class PluginLoaderModule {}
