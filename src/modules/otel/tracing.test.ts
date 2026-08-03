import { describe, expect, it } from 'vitest';

import { getTracer, trace } from './tracing';

describe('tracing hooks', () => {
  it('exports getTracer that returns a usable no-op tracer when OTel is off', () => {
    const tracer = getTracer('@opoha/core/test');
    const span = tracer.startSpan('test.span');
    expect(span.isRecording()).toBe(false);
    span.end();
    expect(trace.getTracer).toBeTypeOf('function');
  });
});
