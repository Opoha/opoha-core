import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
import { PluginLoaderService } from './plugin-loader.service';

const SAMPLE_PLUGIN_ROOT = resolve(__dirname, '../../../../plugin-sample');

function ensureSamplePluginBuilt(): void {
  const entry = join(SAMPLE_PLUGIN_ROOT, 'dist', 'index.js');
  if (existsSync(entry)) {
    return;
  }
  execSync('pnpm install && pnpm build', {
    cwd: SAMPLE_PLUGIN_ROOT,
    stdio: 'pipe',
  });
}

function createLoader(pluginPath: string) {
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
      if (key === 'OPOHA_PLUGINS') {
        return pluginPath;
      }
      if (key === 'OPOHA_PLUGINS_PATH') {
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
  return { loader, contributions, admin, eventBus };
}

describe('D-11 sample plugin integration', () => {
  it('discovers and boots @opoha/plugin-sample without static core imports', async () => {
    expect(existsSync(SAMPLE_PLUGIN_ROOT)).toBe(true);
    ensureSamplePluginBuilt();

    const { loader, contributions, admin, eventBus } =
      createLoader(SAMPLE_PLUGIN_ROOT);

    const result = await loader.loadDefinitions();
    expect(result.ordered.map((p) => p.manifest.id)).toEqual(['sample']);
    expect(result.loaded).toEqual([
      expect.objectContaining({ id: 'sample' }),
    ]);

    // Boundary: production loader path used discovery + dynamic import only.
    expect(loader.getRecord('sample')?.definition?.id).toBe('sample');

    await loader.install('sample');
    await loader.enable('sample');

    expect(loader.getState('sample')).toBe('enabled');
    expect(contributions.listGraphQL(true).map((g) => g.name)).toEqual([
      'samplePing',
    ]);
    expect(
      contributions.getProvider<{ ping: () => string }>('sample.ping')?.ping(),
    ).toBe('pong');
    expect(admin.getManifest(true).plugins).toEqual([
      expect.objectContaining({
        pluginId: 'sample',
        permissions: ['plugin:sample:read'],
      }),
    ]);
    expect(eventBus.listenerCount('PluginSampleEvent')).toBe(1);

    let seen = 0;
    eventBus.subscribe('PluginSampleEvent', async () => {
      seen += 1;
    });
    await eventBus.publish({
      eventName: 'PluginSampleEvent',
      aggregateType: 'sample',
      aggregateId: '1',
      data: { ok: true },
    });
    // Plugin listener + our assert listener both run.
    expect(eventBus.listenerCount('PluginSampleEvent')).toBe(2);
    expect(seen).toBe(1);
  });
});
