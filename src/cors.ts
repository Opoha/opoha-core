const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Resolve Nest CORS `origin` from `CORS_ORIGINS` + `NODE_ENV`.
 * Production requires an explicit allowlist; local defaults to localhost only.
 */
export function resolveCorsOrigin(
  corsOrigins: string,
  nodeEnv: string,
):
  | boolean
  | string[]
  | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const list = corsOrigins
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (list.length > 0) {
    return list;
  }

  if (nodeEnv === 'production') {
    return false;
  }

  return (origin, callback) => {
    if (!origin || LOCALHOST_ORIGIN.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
