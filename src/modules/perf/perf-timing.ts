/**
 * Lightweight timing helpers for Phase 9 service microbenchmarks (C-02).
 * No external load tools; CI-friendly Vitest harness.
 */

export type PercentileStats = {
  samples: number[];
  p50: number;
  p95: number;
  min: number;
  max: number;
};

export type ScenarioResult = PercentileStats & {
  id: string;
  targetP95Ms: number;
  pass: boolean;
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sortedAsc.length - 1);
  return sortedAsc[idx]!;
}

export function summarizeSamples(samples: number[]): PercentileStats {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

export async function measureAsync(
  fn: () => Promise<void>,
  opts: { warmup: number; iterations: number },
): Promise<PercentileStats> {
  for (let i = 0; i < opts.warmup; i++) {
    await fn();
  }
  const samples: number[] = [];
  for (let i = 0; i < opts.iterations; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return summarizeSamples(samples);
}

export function evaluateScenario(
  id: string,
  stats: PercentileStats,
  targetP95Ms: number,
): ScenarioResult {
  return {
    id,
    ...stats,
    targetP95Ms,
    pass: stats.p95 <= targetP95Ms,
  };
}

export function formatScenarioLine(result: ScenarioResult): string {
  const status = result.pass ? 'PASS' : 'FAIL';
  return (
    `${status} ${result.id}: p50=${result.p50.toFixed(2)}ms ` +
    `p95=${result.p95.toFixed(2)}ms (target p95 ≤ ${result.targetP95Ms}ms) ` +
    `min=${result.min.toFixed(2)} max=${result.max.toFixed(2)} n=${result.samples.length}`
  );
}

/** Default SLO ceilings — keep in sync with docs/readiness/performance-benchmarks.md */
export const PERF_SLO_P95_MS = {
  'PERF-CATALOG-LIST': 100,
  'PERF-CART-CREATE-ADD': 50,
  'PERF-CHECKOUT-PREPARE': 50,
  'PERF-ORDERS-PLACE': 100,
} as const;

export type PerfScenarioId = keyof typeof PERF_SLO_P95_MS;
