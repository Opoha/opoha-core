import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { StorageAdapterRegistry } from '../files/public';
import { PaymentProviderRegistry } from '../payment-engine/public';
import { ShippingMethodRegistry } from '../shipping-engine/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { ContributionRegistry } from './contribution-registry';
import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPluginAt,
  discoverPlugins,
  discoverPluginsInDirectory,
  parsePluginPathsEnv,
} from './plugin-discovery';
import {
  canBootPlugin,
  transitionPluginState,
} from './plugin-lifecycle';
import { PluginLoaderService } from './plugin-loader.service';
import {
  PLUGIN_CONTRACT_VERSION,
  parsePluginManifest,
} from './plugin-manifest';
import type { DiscoveredPlugin } from './plugin-manifest';

function pluginDir(
  root: string,
  id: string,
  dependsOn: string[] = [],
  entry = 'dist/index.js',
): string {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'opoha.plugin.json'),
    JSON.stringify({
      id,
      version: '0.1.0',
      contractVersion: PLUGIN_CONTRACT_VERSION,
      entry,
      dependsOn,
    }),
  );
  return dir;
}

function createLoader(configGet?: (key: string) => string | undefined) {
  const eventBus = new EventBusService();
  const contributions = new ContributionRegistry(eventBus);
  const admin = new AdminExtensionRegistry();
  const payment = new PaymentProviderRegistry();
  const shipping = new ShippingMethodRegistry();
  const storage = new StorageAdapterRegistry();
  const config = {
    get: (key: string) => {
      if (configGet) {
        return configGet(key);
      }
      if (key === 'OPOHA_PLUGINS' || key === 'OPOHA_PLUGINS_PATH') {
        return '';
      }
      return undefined;
    },
  };
  const loader = new PluginLoaderService(
    config as never,
    contributions,
    admin,
    payment,
    shipping,
    storage,
  );
  return { loader, contributions, admin, eventBus, payment, shipping, storage };
}

describe('parsePluginManifest', () => {
  it('accepts a valid 0.1 contract manifest with entry', () => {
    const manifest = parsePluginManifest({
      id: 'manual-payment',
      version: '0.1.0',
      contractVersion: '0.1',
      entry: 'src/index.ts',
      dependsOn: ['storage-localfs'],
    });
    expect(manifest.id).toBe('manual-payment');
    expect(manifest.entry).toBe('src/index.ts');
    expect(manifest.dependsOn).toEqual(['storage-localfs']);
  });

  it('defaults entry to dist/index.js', () => {
    const manifest = parsePluginManifest({
      id: 'x',
      version: '1.0.0',
      contractVersion: '0.1',
    });
    expect(manifest.entry).toBe('dist/index.js');
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
        entry: 'dist/index.js',
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

  it('scans OPOHA_PLUGINS_PATH child directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'opoha-plugins-path-'));
    pluginDir(root, 'storage-localfs');
    pluginDir(root, 'manual-payment', ['storage-localfs']);
    const discovered = discoverPluginsInDirectory(root);
    const ordered = orderPluginsByDependency(discovered);
    expect(ordered.map((p) => p.manifest.id)).toEqual([
      'storage-localfs',
      'manual-payment',
    ]);
  });
});

describe('PluginLoaderService.load stub', () => {
  it('validates manifests without executing entry modules', () => {
    const root = mkdtempSync(join(tmpdir(), 'opoha-load-'));
    const a = pluginDir(root, 'alpha');
    const b = pluginDir(root, 'beta', ['alpha']);

    const { loader } = createLoader((key) => {
      if (key === 'OPOHA_PLUGINS') {
        return `${a},${b}`;
      }
      if (key === 'OPOHA_PLUGINS_PATH') {
        return '';
      }
      return undefined;
    });
    const result = loader.load();
    expect(result.ordered.map((p) => p.manifest.id)).toEqual(['alpha', 'beta']);
    expect(result.validated).toHaveLength(2);
    expect(result.validated[0]?.id).toBe('alpha');
  });
});

describe('plugin lifecycle state machine', () => {
  it('allows install → enable → disable → enable → uninstall', () => {
    let state = transitionPluginState('discovered', 'install');
    expect(state).toBe('installed');
    state = transitionPluginState(state, 'enable');
    expect(state).toBe('enabled');
    state = transitionPluginState(state, 'disable');
    expect(state).toBe('disabled');
    state = transitionPluginState(state, 'enable');
    expect(state).toBe('enabled');
    state = transitionPluginState(state, 'uninstall');
    expect(state).toBe('uninstalled');
    expect(canBootPlugin('enabled')).toBe(true);
    expect(canBootPlugin('discovered')).toBe(false);
  });

  it('rejects illegal transitions', () => {
    expect(() => transitionPluginState('discovered', 'enable')).toThrow(
      /cannot enable/,
    );
    expect(() => transitionPluginState('installed', 'disable')).toThrow(
      /cannot disable/,
    );
  });
});

describe('PluginLoaderService lifecycle + registrations', () => {
  it('installs, boots registrations inactive, enable activates listeners and admin', async () => {
    const { loader, contributions, admin, eventBus } = createLoader();
    let seen = 0;

    loader.registerDefinition({
      id: 'sample',
      async boot(ctx) {
        ctx.registerGraphQL({ name: 'samplePing', kind: 'query' });
        ctx.registerProvider({
          token: 'sample.service',
          provider: { ping: () => 'ok' },
        });
        ctx.registerListener('auth.user.created', async () => {
          seen += 1;
        });
        ctx.registerAdmin({
          navigation: [
            {
              id: 'sample-nav',
              label: 'Sample',
              path: '/plugins/sample',
              permission: 'plugin:sample:read',
            },
          ],
          settings: [
            {
              id: 'sample-settings',
              title: 'Sample settings',
              path: '/plugins/sample/settings',
            },
          ],
          permissions: ['plugin:sample:read'],
        });
      },
    });

    await loader.install('sample');
    expect(loader.getState('sample')).toBe('installed');

    await loader.boot('sample');
    expect(contributions.listGraphQL()).toHaveLength(1);
    expect(contributions.listGraphQL(true)).toHaveLength(0);
    expect(admin.getManifest(true).plugins).toHaveLength(0);
    expect(eventBus.listenerCount('auth.user.created')).toBe(0);

    await loader.enable('sample');
    expect(loader.getState('sample')).toBe('enabled');
    expect(contributions.listGraphQL(true)).toHaveLength(1);
    expect(
      contributions.getProvider<{ ping: () => string }>('sample.service')?.ping(),
    ).toBe('ok');
    expect(admin.getManifest(true).plugins).toEqual([
      expect.objectContaining({ pluginId: 'sample' }),
    ]);
    expect(eventBus.listenerCount('auth.user.created')).toBe(1);

    await eventBus.publish({
      eventName: 'auth.user.created',
      aggregateType: 'user',
      aggregateId: 'u1',
      data: { userId: 'u1' },
    });
    expect(seen).toBe(1);

    await loader.disable('sample');
    expect(contributions.listGraphQL(true)).toHaveLength(0);
    expect(admin.getManifest(true).plugins).toHaveLength(0);
    expect(eventBus.listenerCount('auth.user.created')).toBe(0);

    await loader.enable('sample');
    expect(eventBus.listenerCount('auth.user.created')).toBe(1);

    await loader.uninstall('sample');
    expect(loader.getState('sample')).toBe('uninstalled');
    expect(contributions.listGraphQL()).toHaveLength(0);
    expect(admin.getContribution('sample')).toBeUndefined();
  });

  it('registers payment, shipping, and storage engines via context', async () => {
    const { loader, payment, shipping, storage } = createLoader();
    loader.registerDefinition({
      id: 'engines-demo',
      boot(ctx) {
        ctx.registerPaymentProvider({
          code: 'manual',
          displayName: 'Manual',
        });
        ctx.registerShippingMethod({
          code: 'flat-rate',
          displayName: 'Flat rate',
        });
        ctx.registerStorageAdapter({
          code: 'localfs',
          async put({ key, body }) {
            return { key, size: body.byteLength };
          },
          async get() {
            return new Uint8Array();
          },
          async delete() {},
        });
      },
    });

    await loader.install('engines-demo');
    await loader.boot('engines-demo');
    expect(payment.get('manual')).toBeUndefined();
    expect(shipping.get('flat-rate')).toBeUndefined();
    expect(storage.get('localfs')).toBeUndefined();

    await loader.enable('engines-demo');
    expect(payment.get('manual')?.displayName).toBe('Manual');
    expect(shipping.get('flat-rate')?.displayName).toBe('Flat rate');
    expect(storage.get('localfs')?.code).toBe('localfs');

    await loader.disable('engines-demo');
    expect(payment.get('manual')).toBeUndefined();
    expect(shipping.get('flat-rate')).toBeUndefined();
    expect(storage.get('localfs')).toBeUndefined();
  });

  it('detects GraphQL contribution name conflicts across plugins', async () => {
    const { loader, contributions } = createLoader();
    loader.registerDefinition({
      id: 'a',
      boot(ctx) {
        ctx.registerGraphQL({ name: 'sharedQuery', kind: 'query' });
      },
    });
    loader.registerDefinition({
      id: 'b',
      boot(ctx) {
        ctx.registerGraphQL({ name: 'sharedQuery', kind: 'query' });
      },
    });
    await loader.install('a');
    await loader.install('b');
    await loader.enable('a');
    await expect(loader.enable('b')).rejects.toThrow(
      /GraphQL contribution conflict/,
    );
    expect(contributions.listGraphQL(true)).toHaveLength(1);
  });

  it('enable without prior boot activates contributions registered during boot', async () => {
    const { loader, contributions, admin } = createLoader();
    loader.registerDefinition({
      id: 'direct',
      boot(ctx) {
        ctx.registerGraphQL({ name: 'directQ', kind: 'query' });
        ctx.registerAdmin({
          pages: [{ id: 'p1', path: '/p', title: 'P' }],
        });
      },
    });
    await loader.install('direct');
    await loader.enable('direct');
    expect(loader.getState('direct')).toBe('enabled');
    expect(contributions.listGraphQL(true)).toHaveLength(1);
    expect(admin.getManifest(true).plugins).toHaveLength(1);
  });
});

describe('AdminExtensionRegistry', () => {
  it('returns only active plugins in the merged manifest', () => {
    const admin = new AdminExtensionRegistry();
    admin.register(
      {
        pluginId: 'on',
        navigation: [{ id: 'n1', label: 'On', path: '/on' }],
      },
      true,
    );
    admin.register(
      {
        pluginId: 'off',
        navigation: [{ id: 'n2', label: 'Off', path: '/off' }],
      },
      false,
    );
    expect(admin.getManifest(true).plugins.map((p) => p.pluginId)).toEqual([
      'on',
    ]);
    expect(admin.getManifest(false).plugins).toHaveLength(2);
  });
});
