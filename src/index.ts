/**
 * @opoha/core public surface — prefer NestJS modules over deep imports.
 */
export { AppModule } from './app.module';
export { HealthService } from './modules/health/health.service';
export type {
  LivenessResult,
  ReadinessCheckStatus,
  ReadinessResult,
} from './modules/health/health.service';
export {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  MVP_API_VERSION_DATE,
  SUPPORTED_API_VERSIONS,
  resolveApiVersion,
} from './modules/api-versioning/api-version';
export { getTracer, trace } from './modules/otel/tracing';
export { CORE_PACKAGE_NAME, getCorePackageName } from './package-meta';
export {
  AuthModule,
  AuthService,
  GqlAuthGuard,
  hashPassword,
  verifyPassword,
} from './modules/auth/public';
export type { AuthUser, JwtPayload } from './modules/auth/public';
export {
  EventBusModule,
  EventBusService,
  CoreEventName,
  createDomainEvent,
} from './modules/event-bus/public';
export type { DomainEvent, EventListener } from './modules/event-bus/public';
export {
  PluginLoaderModule,
  PluginLoaderService,
  ContributionRegistry,
  AdminExtensionRegistry,
  PLUGIN_CONTRACT_VERSION,
  parsePluginManifest,
  orderPluginsByDependency,
  discoverPlugins,
  transitionPluginState,
  canBootPlugin,
} from './modules/plugin-loader/public';
export type {
  DiscoveredPlugin,
  PluginManifest,
  PluginLoadResult,
  PluginDefinition,
  PluginRegistrationContext,
  PluginLifecycleState,
  AdminContribution,
  AdminExtensionManifest,
} from './modules/plugin-loader/public';
export {
  PaymentEngineModule,
  PaymentEngine,
  PaymentProviderRegistry,
} from './modules/payment-engine/public';
export type { PaymentProvider } from './modules/payment-engine/public';
export {
  ShippingEngineModule,
  ShippingEngine,
  ShippingMethodRegistry,
} from './modules/shipping-engine/public';
export type { ShippingMethodProvider } from './modules/shipping-engine/public';
export {
  FilesModule,
  FilesService,
  StorageAdapterRegistry,
  FileEntity,
} from './modules/files/public';
export type {
  CreateFileMetadataInput,
  StorageAdapter,
} from './modules/files/public';
