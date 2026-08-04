import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadAppEnv } from './database/load-app-env';
import { ConfigService } from './modules/config/config.service';
import { AppLogger } from './modules/logging/app-logger';

loadAppEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`@opoha/core listening on http://localhost:${port}`, 'Bootstrap');
  logger.log(`GraphQL: http://localhost:${port}/graphql`, 'Bootstrap');
  logger.log(`Health:  http://localhost:${port}/health/live`, 'Bootstrap');
}

void bootstrap();
