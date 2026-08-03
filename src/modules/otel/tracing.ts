import { trace } from '@opentelemetry/api';
import type { Tracer } from '@opentelemetry/api';

/**
 * Public tracing hook — returns a Tracer from the global provider.
 * When OTEL is disabled, the API returns a no-op tracer (zero overhead).
 */
export function getTracer(name = '@opoha/core', version?: string): Tracer {
  return trace.getTracer(name, version);
}

export { trace };
