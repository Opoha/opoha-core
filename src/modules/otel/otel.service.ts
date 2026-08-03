import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import { ConfigService } from '../config/config.service';
import { AppLogger } from '../logging/app-logger';

/**
 * Optional OpenTelemetry bootstrap.
 * Initializes only when `OTEL_ENABLED=true`; otherwise leaves the global
 * no-op TracerProvider in place (zero overhead).
 */
@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private provider: BasicTracerProvider | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    if (!this.config.get('OTEL_ENABLED')) {
      return;
    }

    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    });
    trace.setGlobalTracerProvider(provider);
    this.provider = provider;

    // Smoke span so operators can confirm export wiring in logs.
    const tracer = trace.getTracer('@opoha/core');
    const span = tracer.startSpan('opoha.otel.bootstrap');
    span.setAttribute('opoha.otel.enabled', true);
    span.end();

    this.logger.log(
      'OpenTelemetry enabled — console span exporter registered',
      'OpenTelemetry',
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.provider) {
      return;
    }
    await this.provider.shutdown();
    this.provider = null;
  }

  isEnabled(): boolean {
    return this.config.get('OTEL_ENABLED');
  }
}

/** @deprecated Prefer OpenTelemetryService — alias kept for earlier drafts */
export { OpenTelemetryService as OtelService };
