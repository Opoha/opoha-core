import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log(`@opoha/core listening on http://localhost:${port}`);
  logger.log(`GraphQL: http://localhost:${port}/graphql`);
  logger.log(`Health:  http://localhost:${port}/health/live`);
}

void bootstrap();
