import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

/** Packages core must never depend on (D-10 / ADR-0003). */
const FORBIDDEN_DEP_PATTERNS: RegExp[] = [
  /^@opoha\/plugin-/,
  /^stripe$/,
  /^omise$/,
  /^@paypal\//,
  /^aws-sdk$/,
  /^@aws-sdk\//,
  /^meilisearch$/,
];

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /from\s+['"]@opoha\/plugin-[^'"]+['"]/,
  /import\s*\(\s*['"]@opoha\/plugin-[^'"]+['"]\s*\)/,
  /require\s*\(\s*['"]@opoha\/plugin-[^'"]+['"]\s*\)/,
  /from\s+['"]stripe['"]/,
  /from\s+['"]omise['"]/,
  /from\s+['"]@paypal\//,
  /from\s+['"]meilisearch['"]/,
  /from\s+['"]@aws-sdk\//,
];

function collectDeps(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}): string[] {
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ];
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walkTsFiles(path, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

/**
 * H-02 / D-10 — core dependency boundary audit.
 * Core must never depend on `@opoha/plugin-*` or provider SDKs (ADR-0003).
 */
describe('H-02 / D-10 core → plugin boundary', () => {
  it('package.json has no @opoha/plugin-* or provider SDK dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const offenders = collectDeps(pkg).filter((name) =>
      FORBIDDEN_DEP_PATTERNS.some((re) => re.test(name)),
    );
    expect(offenders).toEqual([]);
  });

  it('src has no forbidden plugin/provider imports', () => {
    const files = walkTsFiles(join(ROOT, 'src'));
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN_IMPORT_PATTERNS) {
        if (re.test(text)) {
          hits.push(`${file}: matched ${re}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
