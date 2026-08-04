import { BadRequestException } from '@nestjs/common';

/** BCP 47-like tags (matches stores / localization modules). */
export const LOCALE_RE = /^[a-z]{2}(-[A-Za-z0-9]+)*$/;

type HeaderMap = Record<string, string | string[] | undefined>;

/**
 * Normalize and validate a locale tag.
 */
export function assertLocale(value: string): string {
  const trimmed = value.trim();
  if (!LOCALE_RE.test(trimmed)) {
    throw new BadRequestException(
      `Invalid locale "${value}" (expected BCP 47-like tag, e.g. en-US)`,
    );
  }
  return trimmed;
}

/**
 * Parse the primary locale from an Accept-Language header value.
 * Returns null when absent or unparseable.
 */
export function parseAcceptLanguageHeader(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  // Take first range before comma; strip q-weight.
  const primary = value.split(',')[0]?.trim().split(';')[0]?.trim();
  if (!primary || primary === '*') {
    return null;
  }
  // Accept-Language often uses en-US; normalize underscores.
  const normalized = primary.replace(/_/g, '-');
  if (!LOCALE_RE.test(normalized)) {
    return null;
  }
  return normalized;
}

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
 * Prefer explicit GraphQL `locale` arg; else Accept-Language primary tag.
 */
export function resolveLocalePreference(input: {
  localeArg?: string | null;
  headers?: HeaderMap;
}): string | null {
  if (input.localeArg != null && String(input.localeArg).trim() !== '') {
    return assertLocale(String(input.localeArg));
  }
  const accept = headerValue(input.headers ?? {}, 'accept-language');
  return parseAcceptLanguageHeader(accept);
}
