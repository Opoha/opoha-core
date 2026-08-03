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
import { OFFICIAL_PLUGIN_MATRIX } from './plugin-compat-matrix';
import { PLUGIN_CONTRACT_VERSION } from './plugin-manifest';

const MONOREPO_ROOT = resolve(__dirname, '../../../../');

function pluginRoot(repoDir: string): string {
  return join(MONOREPO_ROOT, repoDir);
}

function ensurePluginBuilt(root: string): void {
  const entry = join(root, 'dist', 'index.js');
  if (existsSync(entry)) {
    return;
  }
  execSync('pnpm install && pnpm build', { cwd: root, stdio: 'pipe' });
}

function createLoader(pluginPaths: string) {
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
        return pluginPaths;
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
  return { loader, contributions, admin, payment, shipping, tax, promotions, notifications, storage, search };
}

/**
 * Phase 9 E-02 — official plugin compatibility integration suite.
 *
 * Loads the entire certified matrix (`docs/readiness/official-plugin-matrix.md`)
 * together through the production `PluginLoaderService` path — discovery,
 * manifest contractVersion checks, dynamic import, install/boot/enable —
 * without core statically importing any `@opoha/plugin-*` package (ADR-0003).
 */
describe('Phase 9 E-02 official plugin compatibility', () => {
  it('every matrix entry has an existing sibling repo with a built entry', () => {
    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      const root = pluginRoot(entry.repoDir);
      expect(existsSync(root), `missing sibling repo: ${entry.repoDir}`).toBe(
        true,
      );
      ensurePluginBuilt(root);
      expect(
        existsSync(join(root, 'dist', 'index.js')),
        `missing build output: ${entry.repoDir}`,
      ).toBe(true);
    }
  });

  it('discovers all 21 certified plugins with compatible contractVersion', async () => {
    const pluginPaths = OFFICIAL_PLUGIN_MATRIX.map((entry) =>
      pluginRoot(entry.repoDir),
    ).join(',');
    const { loader } = createLoader(pluginPaths);

    const discovered = loader.reload();
    expect(discovered).toHaveLength(OFFICIAL_PLUGIN_MATRIX.length);
    const ids = new Set(discovered.map((p) => p.manifest.id));
    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      expect(ids.has(entry.id), `not discovered: ${entry.id}`).toBe(true);
    }
    for (const plugin of discovered) {
      expect(plugin.manifest.contractVersion).toBe(PLUGIN_CONTRACT_VERSION);
    }
  });

  it('loads, installs, and enables the full official matrix without conflicts', async () => {
    const pluginPaths = OFFICIAL_PLUGIN_MATRIX.map((entry) =>
      pluginRoot(entry.repoDir),
    ).join(',');
    const { loader, contributions, admin } = createLoader(pluginPaths);

    const result = await loader.loadDefinitions();
    expect(result.loaded).toHaveLength(OFFICIAL_PLUGIN_MATRIX.length);
    const loadedIds = new Set(result.loaded.map((p) => p.id));
    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      expect(loadedIds.has(entry.id), `not loaded: ${entry.id}`).toBe(true);
    }

    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      await loader.install(entry.id);
    }
    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      await loader.enable(entry.id);
      expect(loader.getState(entry.id)).toBe('enabled');
    }

    // Sanity: at least one contribution and one admin manifest entry landed
    // per plugin — proves boot() ran and registries accepted every plugin's
    // registrations without a duplicate-code / conflict throw (design's
    // "deterministic conflict error" requirement).
    const adminPluginIds = new Set(
      admin.getManifest(true).plugins.map((p) => p.pluginId),
    );
    for (const entry of OFFICIAL_PLUGIN_MATRIX) {
      expect(
        adminPluginIds.has(entry.id),
        `no admin contribution registered for: ${entry.id}`,
      ).toBe(true);
    }
    expect(contributions.listGraphQL(true).length).toBeGreaterThan(0);
  });
});
