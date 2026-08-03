import { Global, Module } from '@nestjs/common';

import { OpenTelemetryService } from './otel.service';

@Global()
@Module({
  providers: [OpenTelemetryService],
  exports: [OpenTelemetryService],
})
export class OpenTelemetryModule {}

/** @deprecated Prefer OpenTelemetryModule */
export { OpenTelemetryModule as OtelModule };
