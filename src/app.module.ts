import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';

import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ApiVersionMiddleware } from './modules/api-versioning/api-version.middleware';
import { ApiVersioningModule } from './modules/api-versioning/api-versioning.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';
import { ShellResolver } from './modules/graphql/shell.resolver';
import { HealthModule } from './modules/health/health.module';
import { CorrelationIdMiddleware } from './modules/logging/correlation-id.middleware';
import { LoggingModule } from './modules/logging/logging.module';
import { OpenTelemetryModule } from './modules/otel/otel.module';
import { PluginLoaderModule } from './modules/plugin-loader/plugin-loader.module';

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
