import { describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '../config/config.service';
import type { AppLogger } from '../logging/app-logger';
import { OpenTelemetryService } from './otel.service';

function createService(enabled: boolean): OpenTelemetryService {
  const config = {
    get: (key: string) => (key === 'OTEL_ENABLED' ? enabled : undefined),
  } as unknown as ConfigService;
  const logger = {
    log: vi.fn(),
  } as unknown as AppLogger;
  return new OpenTelemetryService(config, logger);
}

describe('OpenTelemetryService', () => {
  it('reports disabled when OTEL_ENABLED is false', () => {
    const service = createService(false);
    expect(service.isEnabled()).toBe(false);
  });

  it('does not register a provider when disabled', () => {
    const service = createService(false);
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.isEnabled()).toBe(false);
  });

  it('registers console exporter when enabled and shuts down cleanly', async () => {
    const service = createService(true);
    expect(service.isEnabled()).toBe(true);
    service.onModuleInit();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
