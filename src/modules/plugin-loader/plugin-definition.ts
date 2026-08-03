import type { EventListener, SubscribeOptions } from '../event-bus/domain-event';

import type { AdminContribution } from './admin-extension-registry';
import type { AdminExtensionRegistry } from './admin-extension-registry';
import type { ContributionRegistry } from './contribution-registry';

/**
 * Registration API handed to plugins during install/boot/enable/disable/uninstall.
 */
export type PluginRegistrationContext = {
  readonly pluginId: string;
  registerGraphQL(input: {
    name: string;
    kind: 'type' | 'query' | 'mutation' | 'resolver';
    descriptor?: unknown;
  }): void;
  registerProvider(input: { token: string; provider: unknown }): void;
  registerListener(
    eventName: string,
    handler: EventListener,
    options?: SubscribeOptions,
  ): void;
  registerAdmin(contribution: {
    navigation?: AdminContribution['navigation'];
    pages?: AdminContribution['pages'];
    widgets?: AdminContribution['widgets'];
    settings?: AdminContribution['settings'];
    tabs?: AdminContribution['tabs'];
    permissions?: AdminContribution['permissions'];
  }): void;
};

/**
 * In-process plugin module contract invoked by the loader (D-04 / D-05).
 * Authoring helpers move to `@opoha/plugin-sdk` in D-07.
 */
export type PluginDefinition = {
  id: string;
  install?(ctx: PluginRegistrationContext): void | Promise<void>;
  boot?(ctx: PluginRegistrationContext): void | Promise<void>;
  enable?(ctx: PluginRegistrationContext): void | Promise<void>;
  disable?(ctx: PluginRegistrationContext): void | Promise<void>;
  uninstall?(ctx: PluginRegistrationContext): void | Promise<void>;
};

export function createPluginRegistrationContext(
  pluginId: string,
  contributions: ContributionRegistry,
  admin: AdminExtensionRegistry,
  active: boolean,
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
      contributions.registerListener(
        pluginId,
        eventName,
        handler,
        options,
        active,
      );
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
  };
}
