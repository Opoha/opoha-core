import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';

import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ApiVersionMiddleware } from './modules/api-versioning/api-version.middleware';
import { ApiVersioningModule } from './modules/api-versioning/api-versioning.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/public';
import { ConfigModule } from './modules/config/config.module';
import { CustomerModule } from './modules/customer/public';
import { EventBusModule } from './modules/event-bus/event-bus.module';
import { FilesModule } from './modules/files/public';
import { ShellResolver } from './modules/graphql/shell.resolver';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/public';
import { LocalizationModule } from './modules/localization/public';
import { CorrelationIdMiddleware } from './modules/logging/correlation-id.middleware';
import { LoggingModule } from './modules/logging/logging.module';
import { OpenTelemetryModule } from './modules/otel/otel.module';
import { OrderModule } from './modules/order/public';
import { PaymentEngineModule } from './modules/payment-engine/public';
import { PluginLoaderModule } from './modules/plugin-loader/plugin-loader.module';
import { ShippingEngineModule } from './modules/shipping-engine/public';
import { TaxEngineModule } from './modules/tax-engine/public';
import { PromotionsEngineModule } from './modules/promotions-engine/public';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    OpenTelemetryModule,
    EventBusModule,
    DatabaseModule,
    RedisModule,
    ApiVersioningModule,
    AuthModule,
    FilesModule,
    CatalogModule,
    InventoryModule,
    CustomerModule,
    OrderModule,
    LocalizationModule,
    PaymentEngineModule,
    ShippingEngineModule,
    TaxEngineModule,
    PromotionsEngineModule,
    PluginLoaderModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      path: '/graphql',
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    HealthModule,
  ],
  providers: [ShellResolver],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, ApiVersionMiddleware).forRoutes('*');
  }
}
