import type { EventListener, SubscribeOptions } from '../event-bus/domain-event';
import type { FXRateProvider, FXRateProviderRegistry } from '../currency/public';
import type { JobsService, RegisterScheduledJobInput, ScheduledJobRegistry } from '../jobs/public';
import type { RegisterRuleActionInput, RuleActionRegistry } from '../rules/public';
import type { PaymentProvider, PaymentProviderRegistry } from '../payment-engine/public';
import type { PromotionRuleProvider, PromotionRuleRegistry } from '../promotions-engine/public';
import type { ShippingMethodProvider, ShippingMethodRegistry } from '../shipping-engine/public';
import type { TaxProvider, TaxProviderRegistry } from '../tax-engine/public';
import type { StorageAdapter, StorageAdapterRegistry } from '../files/public';
import type { NotificationProvider, NotificationProviderRegistry } from '../notifications/public';
import type { SearchProvider, SearchProviderRegistry } from '../search-engine/public';

import type { AdminContribution } from './admin-extension-registry';
import type { AdminExtensionRegistry } from './admin-extension-registry';
import type { ContributionRegistry } from './contribution-registry';

/**
 * Registration API handed to plugins during install/boot/enable/disable/uninstall.
 * Mirrors `@opoha/plugin-sdk` PluginContext.
 */
export type PluginRegistrationContext = {
  readonly pluginId: string;
  registerGraphQL(input: {
    name: string;
    kind: 'type' | 'query' | 'mutation' | 'resolver';
    descriptor?: unknown;
  }): void;
  registerProvider(input: { token: string; provider: unknown }): void;
  registerListener(eventName: string, handler: EventListener, options?: SubscribeOptions): void;
  registerAdmin(contribution: {
    navigation?: AdminContribution['navigation'];
    pages?: AdminContribution['pages'];
    widgets?: AdminContribution['widgets'];
    settings?: AdminContribution['settings'];
    tabs?: AdminContribution['tabs'];
    permissions?: AdminContribution['permissions'];
  }): void;
  registerPaymentProvider(provider: PaymentProvider): void;
  registerShippingMethod(method: ShippingMethodProvider): void;
  registerTaxProvider(provider: TaxProvider): void;
  registerPromotionRuleProvider(provider: PromotionRuleProvider): void;
  registerNotificationProvider(provider: NotificationProvider): void;
  registerStorageAdapter(adapter: StorageAdapter): void;
  registerSearchProvider(provider: SearchProvider): void;
 /** Register a live FX rate provider. */
  registerFXProvider(provider: FXRateProvider): void;
 /** Register a cron-style scheduled job. */
  registerScheduledJob(input: RegisterScheduledJobInput): void;
 /** Register a rule action handler. */
  registerRuleAction(input: RegisterRuleActionInput): void;
};

/**
 * In-process plugin module contract invoked by the loader.
 * Authors should prefer `definePlugin` from `@opoha/plugin-sdk`.
 */
export type PluginDefinition = {
  id: string;
  install?(ctx: PluginRegistrationContext): void | Promise<void>;
  boot?(ctx: PluginRegistrationContext): void | Promise<void>;
  enable?(ctx: PluginRegistrationContext): void | Promise<void>;
  disable?(ctx: PluginRegistrationContext): void | Promise<void>;
  uninstall?(ctx: PluginRegistrationContext): void | Promise<void>;
};

export type PluginEngineRegistries = {
  payment?: PaymentProviderRegistry;
  shipping?: ShippingMethodRegistry;
  tax?: TaxProviderRegistry;
  promotions?: PromotionRuleRegistry;
  notifications?: NotificationProviderRegistry;
  storage?: StorageAdapterRegistry;
  search?: SearchProviderRegistry;
  fx?: FXRateProviderRegistry;
  jobs?: JobsService;
  scheduledJobs?: ScheduledJobRegistry;
  ruleActions?: RuleActionRegistry;
};

export function createPluginRegistrationContext(
  pluginId: string,
  contributions: ContributionRegistry,
  admin: AdminExtensionRegistry,
  active: boolean,
  engines: PluginEngineRegistries = {},
): PluginRegistrationContext {
  return {
    pluginId,
    registerGraphQL(input) {
      contributions.registerGraphQL({
        pluginId,
        name: input.name,
        kind: input.kind,
        descriptor: input.descriptor,
        active,
      });
    },
    registerProvider(input) {
      contributions.registerProvider({
        pluginId,
        token: input.token,
        provider: input.provider,
        active,
      });
    },
    registerListener(eventName, handler, options) {
      contributions.registerListener(pluginId, eventName, handler, options, active);
    },
    registerAdmin(contribution) {
      admin.register(
        {
          pluginId,
          navigation: contribution.navigation ?? [],
          pages: contribution.pages ?? [],
          widgets: contribution.widgets ?? [],
          settings: contribution.settings ?? [],
          permissions: contribution.permissions ?? [],
          tabs: contribution.tabs,
        },
        active,
      );
    },
    registerPaymentProvider(provider) {
      if (!engines.payment) {
        throw new Error('Payment engine registry is not available');
      }
      engines.payment.register(pluginId, provider, active);
    },
    registerShippingMethod(method) {
      if (!engines.shipping) {
        throw new Error('Shipping engine registry is not available');
      }
      engines.shipping.register(pluginId, method, active);
    },
    registerTaxProvider(provider) {
      if (!engines.tax) {
        throw new Error('Tax engine registry is not available');
      }
      engines.tax.register(pluginId, provider, active);
    },
    registerPromotionRuleProvider(provider) {
      if (!engines.promotions) {
        throw new Error('Promotions engine registry is not available');
      }
      engines.promotions.register(pluginId, provider, active);
    },
    registerNotificationProvider(provider) {
      if (!engines.notifications) {
        throw new Error('Notifications registry is not available');
      }
      engines.notifications.register(pluginId, provider, active);
    },
    registerStorageAdapter(adapter) {
      if (!engines.storage) {
        throw new Error('Storage adapter registry is not available');
      }
      engines.storage.register(pluginId, adapter, active);
    },
    registerSearchProvider(provider) {
      if (!engines.search) {
        throw new Error('Search engine registry is not available');
      }
      engines.search.register(pluginId, provider, active);
    },
    registerFXProvider(provider) {
      if (!engines.fx) {
        throw new Error('FX rate provider registry is not available');
      }
      engines.fx.register(pluginId, provider, active);
    },
    registerScheduledJob(input) {
      if (!engines.jobs) {
        throw new Error('Jobs service is not available');
      }
      // Persist + queue upsert are async; boot hooks may not await.
      void engines.jobs.registerScheduledJob(pluginId, input, active);
    },
    registerRuleAction(input) {
      if (!engines.ruleActions) {
        throw new Error('Rule action registry is not available');
      }
      engines.ruleActions.register(pluginId, input, active);
    },
  };
}
