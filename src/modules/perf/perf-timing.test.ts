import { describe, expect, it } from 'vitest';

import { evaluateScenario, measureAsync, summarizeSamples } from './perf-timing';

describe('perf-timing helpers (C-02)', () => {
  it('computes p50/p95 from samples', () => {
    const stats = summarizeSamples([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(stats.p50).toBe(50);
    expect(stats.p95).toBe(100);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(100);
  });

  it('evaluateScenario marks pass/fail against target', () => {
    const pass = evaluateScenario('PERF-CATALOG-LIST', summarizeSamples([1, 2, 3]), 10);
    expect(pass.pass).toBe(true);
    const fail = evaluateScenario('PERF-CATALOG-LIST', summarizeSamples([1, 2, 50]), 10);
    expect(fail.pass).toBe(false);
  });

  it('measureAsync discards warmup and records iterations', async () => {
    let calls = 0;
    const stats = await measureAsync(
      async () => {
        calls += 1;
      },
      { warmup: 2, iterations: 3 },
    );
    expect(calls).toBe(5);
    expect(stats.samples).toHaveLength(3);
  });
});
