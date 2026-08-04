/**
 * Request store scoping helpers (Phase 5 A-03).
 * Prefer header over JWT claim when both are present.
 */

/** HTTP header carrying a store UUID. */
export const STORE_ID_HEADER = 'x-opoha-store-id';

/** HTTP header carrying a stable store code. */
export const STORE_CODE_HEADER = 'x-opoha-store-code';

export type StoreContextRef = {
  storeId?: string;
  storeCode?: string;
  /** Where the identifiers came from (for debugging / precedence). */
  source: 'header' | 'jwt' | 'none';
};

export type StoreJwtClaim = {
  storeId?: string;
  storeCode?: string;
};

type HeaderMap = Record<string, string | string[] | undefined>;

function headerValue(headers: HeaderMap, name: string): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extract store identifiers from HTTP headers.
 */
export function extractStoreContextFromHeaders(headers: HeaderMap): StoreContextRef {
  const storeId = headerValue(headers, STORE_ID_HEADER);
  const storeCode = headerValue(headers, STORE_CODE_HEADER);
  if (!storeId && !storeCode) {
    return { source: 'none' };
  }
  return {
    ...(storeId ? { storeId } : {}),
    ...(storeCode ? { storeCode } : {}),
    source: 'header',
  };
}

/**
 * Extract store identifiers from a JWT payload claim (optional `storeId` / `storeCode`).
 */
export function extractStoreContextFromJwt(
  payload: StoreJwtClaim | null | undefined,
): StoreContextRef {
  if (!payload) {
    return { source: 'none' };
  }
  const storeId =
    typeof payload.storeId === 'string' && payload.storeId.trim()
      ? payload.storeId.trim()
      : undefined;
  const storeCode =
    typeof payload.storeCode === 'string' && payload.storeCode.trim()
      ? payload.storeCode.trim()
      : undefined;
  if (!storeId && !storeCode) {
    return { source: 'none' };
  }
  return {
    ...(storeId ? { storeId } : {}),
    ...(storeCode ? { storeCode } : {}),
    source: 'jwt',
  };
}

/**
 * Resolve store context: headers win over JWT claims.
 */
export function resolveStoreContext(input: {
  headers?: HeaderMap;
  jwt?: StoreJwtClaim | null;
}): StoreContextRef {
  const fromHeaders = extractStoreContextFromHeaders(input.headers ?? {});
  if (fromHeaders.source === 'header') {
    return fromHeaders;
  }
  return extractStoreContextFromJwt(input.jwt);
}
