import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FXRateProviderRegistry } from '../currency/public';
import { EventBusService } from '../event-bus/event-bus.service';
import { StorageAdapterRegistry } from '../files/public';
import { NotificationProviderRegistry } from '../notifications/public';
import { PaymentProviderRegistry } from '../payment-engine/public';
import { PromotionRuleRegistry } from '../promotions-engine/public';
import { SearchProviderRegistry } from '../search-engine/public';
import { ShippingMethodRegistry } from '../shipping-engine/public';
import { TaxProviderRegistry } from '../tax-engine/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { ContributionRegistry } from './contribution-registry';
import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPluginAt,
  discoverPlugins,
  discoverPluginsFromAppConfig,
  discoverPluginsInDirectory,
  parsePluginPathsEnv,
} from './plugin-discovery';
import {
  findOpohaAppConfig,
  parsePluginsField,
  resolveAppConfigStartDir,
  resolvePluginSpecifier,
} from './opoha-app-config';
import { canBootPlugin, transitionPluginState } from './plugin-lifecycle';
import { PluginLoaderService } from './plugin-loader.service';
import { PLUGIN_CONTRACT_VERSION, parsePluginManifest } from './plugin-manifest';
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
  const tax = new TaxProviderRegistry();
  const promotions = new PromotionRuleRegistry();
  const notifications = new NotificationProviderRegistry();
  const storage = new StorageAdapterRegistry();
  const search = new SearchProviderRegistry();
  const fx = new FXRateProviderRegistry();
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
    tax,
    promotions,
    notifications,
    storage,
    search,
    fx,
  );
  return {
    loader,
    contributions,
    admin,
    eventBus,
    payment,
    shipping,
    tax,
    promotions,
    notifications,
    storage,
    search,
    fx,
  };
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
    const ordered = orderPluginsByDependency([stub('b', ['a']), stub('a'), stub('c', ['b'])]);
    expect(ordered.map((p) => p.manifest.id)).toEqual(['a', 'b', 'c']);
  });

  it('detects cycles', () => {
    expect(() => orderPluginsByDependency([stub('a', ['b']), stub('b', ['a'])])).toThrow(
      /Circular/,
    );
  });

  it('detects missing dependencies', () => {
    expect(() => orderPluginsByDependency([stub('a', ['missing'])])).toThrow(/missing plugin/);
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
    expect(ordered.map((p) => p.manifest.id)).toEqual(['storage-localfs', 'manual-payment']);
  });

  it('loads plugins from opoha.config.json (config-first)', () => {
    const app = mkdtempSync(join(tmpdir(), 'opoha-config-plugins-'));
    const plugs = join(app, 'plugins');
    const alpha = pluginDir(plugs, 'alpha');
    const beta = pluginDir(plugs, 'beta', ['alpha']);
    writeFileSync(
      join(app, 'opoha.config.json'),
      JSON.stringify({
        name: 'test-app',
        plugins: [alpha, './plugins/beta'],
      }),
    );

    const cwd = process.cwd();
    try {
      process.chdir(app);
      const discovered = discoverPluginsFromAppConfig(app);
      expect(discovered.map((p) => p.manifest.id).sort()).toEqual(['alpha', 'beta']);

      const { loader } = createLoader((key) => {
        if (key === 'OPOHA_PLUGINS' || key === 'OPOHA_PLUGINS_PATH') {
          return '';
        }
        return undefined;
      });
      const ordered = loader.reload();
      expect(ordered.map((p) => p.manifest.id)).toEqual(['alpha', 'beta']);
    } finally {
      process.chdir(cwd);
    }
  });

  it('loads app opoha.config.json via OPOHA_APP_ROOT when cwd is linked core', () => {
    const parent = mkdtempSync(join(tmpdir(), 'opoha-link-app-root-'));
    const app = join(parent, 'my-app');
    const coreLike = join(parent, 'opoha-core');
    mkdirSync(app, { recursive: true });
    mkdirSync(coreLike, { recursive: true });
    const plugs = join(app, 'plugins');
    const alpha = pluginDir(plugs, 'alpha');
    writeFileSync(
      join(app, 'opoha.config.json'),
      JSON.stringify({ name: 'linked-app', plugins: ['./plugins/alpha'] }),
    );
    writeFileSync(
      join(coreLike, 'package.json'),
      JSON.stringify({ name: '@opoha/core', version: '0.0.0' }),
    );

    expect(resolveAppConfigStartDir(coreLike, { OPOHA_APP_ROOT: app })).toBe(resolve(app));

    const cwd = process.cwd();
    const prev = process.env.OPOHA_APP_ROOT;
    try {
      process.chdir(coreLike);
      process.env.OPOHA_APP_ROOT = app;
      // cwd has no opoha.config.json and walking parents never reaches sibling app
      expect(discoverPluginsFromAppConfig(process.cwd())).toEqual([]);
      const { loader } = createLoader((key) => {
        if (key === 'OPOHA_PLUGINS' || key === 'OPOHA_PLUGINS_PATH') {
          return '';
        }
        return undefined;
      });
      const ordered = loader.reload();
      expect(ordered.map((p) => p.manifest.id)).toEqual(['alpha']);
      expect(ordered[0]?.rootPath).toBe(alpha);
    } finally {
      process.chdir(cwd);
      if (prev === undefined) {
        delete process.env.OPOHA_APP_ROOT;
      } else {
        process.env.OPOHA_APP_ROOT = prev;
      }
    }
  });

  it('env OPOHA_PLUGINS overrides same id from config', () => {
    const app = mkdtempSync(join(tmpdir(), 'opoha-env-override-'));
    const configPlugin = pluginDir(app, 'from-config');
    const envPluginRoot = mkdtempSync(join(tmpdir(), 'opoha-env-plug-'));
    const envPlugin = pluginDir(envPluginRoot, 'from-config');
    // Give env copy a different version so we can tell which won
    writeFileSync(
      join(envPlugin, 'opoha.plugin.json'),
      JSON.stringify({
        id: 'from-config',
        version: '9.9.9',
        contractVersion: PLUGIN_CONTRACT_VERSION,
        entry: 'dist/index.js',
        dependsOn: [],
      }),
    );
    writeFileSync(
      join(app, 'opoha.config.json'),
      JSON.stringify({ plugins: [configPlugin] }),
    );

    const cwd = process.cwd();
    try {
      process.chdir(app);
      const { loader } = createLoader((key) => {
        if (key === 'OPOHA_PLUGINS') {
          return envPlugin;
        }
        if (key === 'OPOHA_PLUGINS_PATH') {
          return '';
        }
        return undefined;
      });
      const ordered = loader.reload();
      expect(ordered).toHaveLength(1);
      expect(ordered[0]?.manifest.version).toBe('9.9.9');
      expect(ordered[0]?.rootPath).toBe(envPlugin);
    } finally {
      process.chdir(cwd);
    }
  });

  it('parsePluginsField + resolvePluginSpecifier helpers', () => {
    expect(parsePluginsField(['@opoha/plugin-x', '  ./local  ', 1, null])).toEqual([
      '@opoha/plugin-x',
      './local',
    ]);
    expect(parsePluginsField([{ path: '../plugin-a' }, { package: '@opoha/plugin-b' }])).toEqual([
      '../plugin-a',
      '@opoha/plugin-b',
    ]);

    const root = mkdtempSync(join(tmpdir(), 'opoha-resolve-'));
    const plug = pluginDir(root, 'local-plug');
    expect(resolvePluginSpecifier(plug, root)).toBe(plug);
    expect(resolvePluginSpecifier('./local-plug', root)).toBe(plug);
    expect(findOpohaAppConfig(root)).toBeNull();
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
    expect(() => transitionPluginState('discovered', 'enable')).toThrow(/cannot enable/);
    expect(() => transitionPluginState('installed', 'disable')).toThrow(/cannot disable/);
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
    expect(contributions.getProvider<{ ping: () => string }>('sample.service')?.ping()).toBe('ok');
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

  it('registers payment, shipping, tax, promotions, notifications, storage, search, and fx engines via context', async () => {
    const { loader, payment, shipping, tax, promotions, notifications, storage, search, fx } =
      createLoader();
    loader.registerDefinition({
      id: 'engines-demo',
      boot(ctx) {
        ctx.registerPaymentProvider({
          code: 'manual',
          displayName: 'Manual',
          async authorize() {
            return { status: 'authorized' };
          },
          async capture() {
            return { status: 'captured' };
          },
          async refund() {
            return { status: 'refunded' };
          },
        });
        ctx.registerShippingMethod({
          code: 'flat-rate',
          displayName: 'Flat rate',
          async quoteRates() {
            return [];
          },
        });
        ctx.registerTaxProvider({
          code: 'standard',
          displayName: 'Standard tax',
          async calculateTax(input) {
            return {
              currencyCode: input.currencyCode,
              pricingMode: input.pricingMode,
              taxMinor: '0',
              lines: [],
            };
          },
        });
        ctx.registerPromotionRuleProvider({
          code: 'coupon',
          displayName: 'Coupon',
          async apply(input) {
            return {
              currencyCode: input.currencyCode,
              discountMinor: '0',
              applications: [],
            };
          },
        });
        ctx.registerNotificationProvider({
          code: 'smtp',
          displayName: 'SMTP',
          async send() {
            return { status: 'sent', providerCode: 'smtp', messageId: 'msg_1' };
          },
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
        ctx.registerSearchProvider({
          code: 'meilisearch',
          displayName: 'Meilisearch',
          async indexDocument() {},
          async deleteDocument() {},
          async search(input) {
            return {
              query: input.query,
              hits: [],
              total: 0,
              providerCode: 'meilisearch',
            };
          },
        });
        ctx.registerFXProvider({
          code: 'openexchangerates',
          displayName: 'Open Exchange Rates',
          async getRate() {
            return { rate: 1 };
          },
        });
      },
    });

    await loader.install('engines-demo');
    await loader.boot('engines-demo');
    expect(payment.get('manual')).toBeUndefined();
    expect(shipping.get('flat-rate')).toBeUndefined();
    expect(tax.get('standard')).toBeUndefined();
    expect(promotions.get('coupon')).toBeUndefined();
    expect(notifications.get('smtp')).toBeUndefined();
    expect(storage.get('localfs')).toBeUndefined();
    expect(search.get('meilisearch')).toBeUndefined();
    expect(fx.get('openexchangerates')).toBeUndefined();

    await loader.enable('engines-demo');
    expect(payment.get('manual')?.displayName).toBe('Manual');
    expect(shipping.get('flat-rate')?.displayName).toBe('Flat rate');
    expect(tax.get('standard')?.displayName).toBe('Standard tax');
    expect(promotions.get('coupon')?.displayName).toBe('Coupon');
    expect(notifications.get('smtp')?.displayName).toBe('SMTP');
    expect(storage.get('localfs')?.code).toBe('localfs');
    expect(search.get('meilisearch')?.displayName).toBe('Meilisearch');
    expect(fx.get('openexchangerates')?.displayName).toBe('Open Exchange Rates');

    await loader.disable('engines-demo');
    expect(payment.get('manual')).toBeUndefined();
    expect(shipping.get('flat-rate')).toBeUndefined();
    expect(tax.get('standard')).toBeUndefined();
    expect(promotions.get('coupon')).toBeUndefined();
    expect(notifications.get('smtp')).toBeUndefined();
    expect(storage.get('localfs')).toBeUndefined();
    expect(search.get('meilisearch')).toBeUndefined();
    expect(fx.get('openexchangerates')).toBeUndefined();
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
    await expect(loader.enable('b')).rejects.toThrow(/GraphQL contribution conflict/);
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
    expect(admin.getManifest(true).plugins.map((p) => p.pluginId)).toEqual(['on']);
    expect(admin.getManifest(false).plugins).toHaveLength(2);
  });
});
