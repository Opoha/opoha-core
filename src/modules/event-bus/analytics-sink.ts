import type { DomainEvent } from './domain-event';

/**
 * Analytics sink port — plugins / storefront adapters implement; core never
 * imports GA/Meta/provider SDKs.
 */
export type AnalyticsSink = {
  readonly code: string;
  readonly displayName: string;
  handle(event: DomainEvent): void | Promise<void>;
};

export type RegisteredAnalyticsSink = {
  pluginId: string;
  sink: AnalyticsSink;
  active: boolean;
};
