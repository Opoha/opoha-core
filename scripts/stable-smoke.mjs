#!/usr/bin/env node
/**
 * Phase 9 G-02 — stable aggregate smoke:
 * walking-skeleton + plugin-compat + perf-bench + boundary.
 * Exit non-zero on failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const steps = [
  {
    label: 'Walking skeleton (opoha-core walking-skeleton)',
    cwd: coreRoot,
    args: ['walking-skeleton'],
    env: { SKIP_DOCKER: '1' },
  },
  {
    label: 'Plugin compatibility (opoha-core plugin-compat-smoke)',
    cwd: coreRoot,
    args: ['plugin-compat-smoke'],
  },
  {
    label: 'Performance bench (opoha-core perf-bench)',
    cwd: coreRoot,
    args: ['perf-bench'],
  },
  {
    label: 'Boundary audit (opoha-core test:boundary)',
    cwd: coreRoot,
    args: ['test:boundary'],
  },
];

function fail(msg) {
  console.error(`stable-smoke: ${msg}`);
  process.exit(1);
}

function runPnpm(cwd, args, env) {
  if (!existsSync(join(cwd, 'package.json'))) {
    fail(`missing package at ${cwd}`);
  }
  const result = spawnSync('pnpm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

console.log('Stable smoke (Phase 9 G-02) — starting');

for (const step of steps) {
  console.log(`\n→ ${step.label}`);
  const out = runPnpm(step.cwd, step.args, step.env ?? {});
  if (out.stdout) process.stdout.write(out.stdout);
  if (out.stderr) process.stderr.write(out.stderr);
  if (out.code !== 0) {
    fail(`${step.label} failed (exit ${out.code})`);
  }
}

console.log(
  '\nStable smoke OK (walking-skeleton + plugin-compat + perf-bench + boundary)',
);
process.exit(0);
