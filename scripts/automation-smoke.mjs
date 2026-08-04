#!/usr/bin/env node
/**
 * Phase 8 F-02 — automation smoke:
 * Jobs + workflow (OrderPaid) + rules + webhooks retry + boundary.
 * Orchestrates existing gate smokes across sibling packages + core boundary.
 * Exit non-zero on failure.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = join(coreRoot, '..');

const steps = [
  {
    label: 'Jobs gate (opoha-core jobs-smoke)',
    cwd: coreRoot,
    args: ['jobs-smoke'],
  },
  {
    label: 'Workflow gate (plugin-workflow workflow-smoke)',
    cwd: join(monorepoRoot, 'plugin-workflow'),
    args: ['workflow-smoke'],
  },
  {
    label: 'Rules gate (opoha-core rules-smoke)',
    cwd: coreRoot,
    args: ['rules-smoke'],
  },
  {
    label: 'Webhooks gate (opoha-core webhooks-smoke)',
    cwd: coreRoot,
    args: ['webhooks-smoke'],
  },
  {
    label: 'Boundary audit (opoha-core test:boundary)',
    cwd: coreRoot,
    args: ['test:boundary'],
  },
];

function fail(msg) {
  console.error(`automation-smoke: ${msg}`);
  process.exit(1);
}

function runPnpm(cwd, args) {
  if (!existsSync(join(cwd, 'package.json'))) {
    fail(`missing package at ${cwd}`);
  }
  const result = spawnSync('pnpm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

console.log('Automation smoke (Phase 8 F-02) — starting');

for (const step of steps) {
  console.log(`\n→ ${step.label}`);
  const out = runPnpm(step.cwd, step.args);
  if (out.stdout) process.stdout.write(out.stdout);
  if (out.stderr) process.stderr.write(out.stderr);
  if (out.code !== 0) {
    fail(`${step.label} failed (exit ${out.code})`);
  }
}

console.log('\nAutomation smoke OK (jobs + workflow + rules + webhooks + boundary)');
process.exit(0);
