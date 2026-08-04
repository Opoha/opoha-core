#!/usr/bin/env node
/**
 * Omnichannel smoke:
 * POS sale + marketplace vendor order + digital download + subscription renew stub.
 * Orchestrates existing gate smokes across sibling packages + core event/boundary checks.
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
    label: 'POS gate (plugin-pos pos-smoke)',
    cwd: join(monorepoRoot, 'plugin-pos'),
    args: ['pos-smoke'],
  },
  {
    label: 'Marketplace gate (plugin-marketplace marketplace-smoke)',
    cwd: join(monorepoRoot, 'plugin-marketplace'),
    args: ['marketplace-smoke'],
  },
  {
    label: 'Digital gate (opoha-core digital-smoke)',
    cwd: coreRoot,
    args: ['digital-smoke'],
  },
  {
    label: 'Subscriptions gate (plugin-subscription subscriptions-smoke)',
    cwd: join(monorepoRoot, 'plugin-subscription'),
    args: ['subscriptions-smoke'],
  },
  {
    label: 'Omnichannel events + foundations (core vitest)',
    cwd: coreRoot,
    args: [
      'exec',
      'vitest',
      'run',
      'src/modules/omnichannel/omnichannel-gate.smoke.test.ts',
      'src/modules/omnichannel/omnichannel-foundations.smoke.test.ts',
      'src/modules/order/orders.service.test.ts',
      'src/modules/subscriptions/subscription.service.test.ts',
    ],
  },
  {
    label: 'Boundary audit (opoha-core test:boundary)',
    cwd: coreRoot,
    args: ['test:boundary'],
  },
];

function fail(msg) {
  console.error(`omnichannel-smoke: ${msg}`);
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

console.log('Omnichannel smoke — starting');

for (const step of steps) {
  console.log(`\n→ ${step.label}`);
  const out = runPnpm(step.cwd, step.args);
  if (out.stdout) process.stdout.write(out.stdout);
  if (out.stderr) process.stderr.write(out.stderr);
  if (out.code !== 0) {
    fail(`${step.label} failed (exit ${out.code})`);
  }
}

console.log(
  '\nOmnichannel smoke OK (POS + marketplace + digital + subscriptions + events + boundary)',
);
process.exit(0);
