import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';

import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ApiVersionMiddleware } from './modules/api-versioning/api-version.middleware';
import { ApiVersioningModule } from './modules/api-versioning/api-versioning.module';
import { AdminOpsModule } from './modules/admin-ops/public';
import { AuthModule } from './modules/auth/auth.module';
import { B2bModule } from './modules/b2b/public';
import { CatalogModule } from './modules/catalog/public';
import { ConfigModule } from './modules/config/config.module';
import { ConfigurationSettingsModule } from './modules/config/public';
import { CurrencyModule } from './modules/currency/public';
import { CustomerModule } from './modules/customer/public';
import { DigitalModule } from './modules/digital/public';
import { EventBusModule } from './modules/event-bus/event-bus.module';
import { FilesModule } from './modules/files/public';
import { ShellResolver } from './modules/graphql/shell.resolver';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/public';
import { FulfillmentModule } from './modules/fulfillment/public';
import { GiftCardsModule } from './modules/gift-cards/public';
import { LoyaltyModule } from './modules/loyalty/public';
import { ReturnsModule } from './modules/returns/public';
import { SegmentsModule } from './modules/segments/public';
import { StoresModule } from './modules/stores/public';
import { resolveStoreContext } from './modules/stores/store-context';
import { SupplyModule } from './modules/supply/public';
import { VendorsModule } from './modules/vendors/public';
import { WarehousesModule } from './modules/warehouses/public';
import { LocalizationModule } from './modules/localization/public';
import { CorrelationIdMiddleware } from './modules/logging/correlation-id.middleware';
import { LoggingModule } from './modules/logging/logging.module';
import { OpenTelemetryModule } from './modules/otel/otel.module';
import { OrderModule } from './modules/order/public';
import { PaymentEngineModule } from './modules/payment-engine/public';
import { PluginLoaderModule } from './modules/plugin-loader/plugin-loader.module';
import { ShippingEngineModule } from './modules/shipping-engine/public';
import { TaxEngineModule } from './modules/tax-engine/public';
import { NotificationsModule } from './modules/notifications/public';
import { PromotionsEngineModule } from './modules/promotions-engine/public';
import { SearchEngineModule } from './modules/search-engine/public';

type GqlHttpRequest = {
  headers?: Record<string, string | string[] | undefined>;
};

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
    WarehousesModule,
    InventoryModule,
    SupplyModule,
    VendorsModule,
    DigitalModule,
    FulfillmentModule,
    GiftCardsModule,
    LoyaltyModule,
    SegmentsModule,
    StoresModule,
    ConfigurationSettingsModule,
    CurrencyModule,
    ReturnsModule,
    AdminOpsModule,
    CustomerModule,
    B2bModule,
    OrderModule,
    LocalizationModule,
    PaymentEngineModule,
    ShippingEngineModule,
    TaxEngineModule,
    PromotionsEngineModule,
    NotificationsModule,
    SearchEngineModule,
    PluginLoaderModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      path: '/graphql',
      context: ({ req }: { req: GqlHttpRequest }) => ({
        req,
        // Header-only at factory time (JWT auth runs later in guards).
        // Use resolveStoreContext({ headers, jwt: req.user }) after auth when needed.
        storeContext: resolveStoreContext({
          headers: req.headers ?? {},
        }),
      }),
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
