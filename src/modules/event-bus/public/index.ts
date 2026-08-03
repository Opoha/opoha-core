/**
 * Public event-bus surface for other core modules (and future plugin-sdk re-exports).
 */
export { EventBusModule } from '../event-bus.module';
export { EventBusService } from '../event-bus.service';
export {
  createDomainEvent,
  domainEventEnvelopeSchema,
  domainEventMetadataSchema,
} from '../domain-event';
export type {
  DomainEvent,
  DomainEventEnvelope,
  DomainEventMetadata,
  EventErrorPolicy,
  EventListener,
  PublishInput,
  SubscribeOptions,
} from '../domain-event';
export { AUTH_EVENT_NAMES, CoreEventName } from '../event-catalog';
export type { AuthEventName } from '../event-catalog';
export {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_STOREFRONT_MAP,
  isAnalyticsEventName,
} from '../analytics-catalog';
export type {
  AnalyticsEventName,
  AnalyticsStorefrontMapping,
} from '../analytics-catalog';
export { AnalyticsSinkRegistry } from '../analytics-sink.registry';
export { AnalyticsSinkDispatcher } from '../analytics-sink.dispatcher';
export type { AnalyticsSink, RegisteredAnalyticsSink } from '../analytics-sink';
