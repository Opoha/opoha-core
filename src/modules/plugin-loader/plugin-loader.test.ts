import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPluginAt,
  discoverPlugins,
  parsePluginPathsEnv,
} from './plugin-discovery';
import {
  PLUGIN_CONTRACT_VERSION,
  parsePluginManifest,
} from './plugin-manifest';
import type { DiscoveredPlugin } from './plugin-manifest';

function pluginDir(
  root: string,
  id: string,
  dependsOn: string[] = [],
): string {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'opoha.plugin.json'),
    JSON.stringify({
      id,
      version: '0.1.0',
      contractVersion: PLUGIN_CONTRACT_VERSION,
      dependsOn,
    }),
  );
  return dir;
}

describe('parsePluginManifest', () => {
  it('accepts a valid 0.1 contract manifest', () => {
    const manifest = parsePluginManifest({
      id: 'manual-payment',
      version: '0.1.0',
      contractVersion: '0.1',
      dependsOn: ['storage-localfs'],
    });
    expect(manifest.id).toBe('manual-payment');
    expect(manifest.dependsOn).toEqual(['storage-localfs']);
  });

  it('rejects incompatible contractVersion', () => {
    expect(() =>
      parsePluginManifest({
        id: 'x',
        version: '1.0.0',
        contractVersion: '9.9',
      }),
    ).toThrow(/incompatible/);
  });
});

describe('orderPluginsByDependency', () => {
  function stub(id: string, dependsOn: string[] = []): DiscoveredPlugin {
    return {
      rootPath: `/tmp/${id}`,
      manifestSource: 'opoha.plugin.json',
      manifest: {
        id,
        version: '0.1.0',
        contractVersion: '0.1',
        dependsOn,
        required: false,
      },
    };
  }

  it('orders dependencies before dependents', () => {
    const ordered = orderPluginsByDependency([
      stub('b', ['a']),
      stub('a'),
      stub('c', ['b']),
    ]);
    expect(ordered.map((p) => p.manifest.id)).toEqual(['a', 'b', 'c']);
  });

  it('detects cycles', () => {
    expect(() =>
      orderPluginsByDependency([stub('a', ['b']), stub('b', ['a'])]),
    ).toThrow(/Circular/);
  });

  it('detects missing dependencies', () => {
    expect(() => orderPluginsByDependency([stub('a', ['missing'])])).toThrow(
      /missing plugin/,
    );
  });
});

describe('plugin discovery', () => {
  it('parses OPOHA_PLUGINS comma and JSON forms', () => {
    expect(parsePluginPathsEnv('a,b , c')).toEqual(['a', 'b', 'c']);
    expect(parsePluginPathsEnv('["/p1","/p2"]')).toEqual(['/p1', '/p2']);
    expect(parsePluginPathsEnv('')).toEqual([]);
  });

  it('discovers opoha.plugin.json and package.json#opoha', () => {
    const root = mkdtempSync(join(tmpdir(), 'opoha-plugins-'));
    const a = pluginDir(root, 'alpha');
    const b = join(root, 'beta');
    mkdirSync(b);
    writeFileSync(
      join(b, 'package.json'),
      JSON.stringify({
        name: 'beta',
        opoha: {
          id: 'beta',
          version: '0.1.0',
          contractVersion: PLUGIN_CONTRACT_VERSION,
          dependsOn: ['alpha'],
        },
      }),
    );

    const alpha = discoverPluginAt(a);
    expect(alpha.manifest.id).toBe('alpha');
    expect(alpha.manifestSource).toBe('opoha.plugin.json');

    const discovered = discoverPlugins([b, a]);
    const ordered = orderPluginsByDependency(discovered);
    expect(ordered.map((p) => p.manifest.id)).toEqual(['alpha', 'beta']);
  });
});
