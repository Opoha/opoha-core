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
