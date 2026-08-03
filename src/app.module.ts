import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ConfigModule } from './modules/config/config.module';
import { ShellResolver } from './modules/graphql/shell.resolver';
import { HealthModule } from './modules/health/health.module';
import { CorrelationIdMiddleware } from './modules/logging/correlation-id.middleware';
import { LoggingModule } from './modules/logging/logging.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
      path: '/graphql',
    }),
    HealthModule,
  ],
  providers: [ShellResolver],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
