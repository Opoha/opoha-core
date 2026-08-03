import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { AppLogger } from '../logging/app-logger';

/**
 * Optional OpenTelemetry bootstrap (B-05).
 * Enabled via `OTEL_ENABLED=true`. Uses OTLP HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT`
 * is set; otherwise a console span exporter so local enablement is observable.
 */
@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private sdk: NodeSDK | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AppLogger) private readonly logger: AppLogger,
  ) {}

  isEnabled(): boolean {
    return this.config.get('OTEL_ENABLED');
  }

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('OpenTelemetry disabled (set OTEL_ENABLED=true to enable)', 'Otel');
      return;
    }

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const exporter = endpoint
      ? new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })
      : new ConsoleSpanExporter();

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        'service.name': 'opoha-core',
        'service.version': '0.1.0',
      }),
      traceExporter: exporter,
    });
    this.sdk.start();
    this.logger.log(
      endpoint
        ? `OpenTelemetry started (OTLP → ${endpoint})`
        : 'OpenTelemetry started (console exporter; set OTEL_EXPORTER_OTLP_ENDPOINT for OTLP)',
      'Otel',
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.sdk = null;
    }
  }
}

/** @deprecated Prefer OpenTelemetryService — alias kept for earlier drafts */
export { OpenTelemetryService as OtelService };
