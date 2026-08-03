import { Global, Module } from '@nestjs/common';

import { AppLogger } from './app-logger';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  providers: [
    {
      provide: AppLogger,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new AppLogger(config.get('LOG_LEVEL')),
    },
  ],
  exports: [AppLogger],
})
export class LoggingModule {}
