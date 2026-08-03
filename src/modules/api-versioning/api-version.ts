/**
 * API versioning baseline (MVP).
 *
 * Strategy: request header `X-API-Version` (GraphQL-friendly; path versioning
 * deferred). Default when omitted: `1`. Date alias `2026-08-03` is accepted as
 * the MVP freeze tag for the same baseline.
 *
 * See workspace: docs/architecture/api-versioning.md
 */

/** Canonical HTTP header (Express lowercases incoming names). */
export const API_VERSION_HEADER = 'x-api-version';

/** Default / current major version for MVP. */
export const DEFAULT_API_VERSION = '1';

/** MVP freeze-date alias — same contract as `1`. */
export const MVP_API_VERSION_DATE = '2026-08-03';

/** Versions accepted by the middleware. */
export const SUPPORTED_API_VERSIONS: ReadonlySet<string> = new Set([
  DEFAULT_API_VERSION,
  MVP_API_VERSION_DATE,
]);

/**
 * Normalize a client version token to the canonical major (`1`).
 */
export function resolveApiVersion(raw: string | undefined): string | null {
  const value = (raw ?? '').trim() || DEFAULT_API_VERSION;
  if (!SUPPORTED_API_VERSIONS.has(value)) {
    return null;
  }
  return DEFAULT_API_VERSION;
}

export function unsupportedApiVersionMessage(received: string): string {
  const supported = [...SUPPORTED_API_VERSIONS].join(', ');
  return `Unsupported API version '${received}'. Supported: ${supported}. Omit the header to use default '${DEFAULT_API_VERSION}'.`;
}
