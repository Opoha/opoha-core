import { randomBytes } from 'node:crypto';

export const DIGITAL_DOWNLOAD_TOKEN_STATUSES = [
  'active',
  'exhausted',
  'revoked',
  'expired',
] as const;

export type DigitalDownloadTokenStatus =
  (typeof DIGITAL_DOWNLOAD_TOKEN_STATUSES)[number];

export const DIGITAL_LICENSE_KEY_STATUSES = [
  'active',
  'revoked',
  'expired',
] as const;

export type DigitalLicenseKeyStatus =
  (typeof DIGITAL_LICENSE_KEY_STATUSES)[number];

export function isDigitalDownloadTokenStatus(
  value: string,
): value is DigitalDownloadTokenStatus {
  return (DIGITAL_DOWNLOAD_TOKEN_STATUSES as readonly string[]).includes(value);
}

export function isDigitalLicenseKeyStatus(
  value: string,
): value is DigitalLicenseKeyStatus {
  return (DIGITAL_LICENSE_KEY_STATUSES as readonly string[]).includes(value);
}

/** Opaque URL-safe download token (32 hex chars). */
export function generateDownloadToken(): string {
  return randomBytes(16).toString('hex');
}

/** Human-readable license key segments (XXXX-XXXX-XXXX-XXXX). */
export function generateLicenseKey(): string {
  const raw = randomBytes(8).toString('hex').toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/** Default stub asset path until storage adapter wiring (Phase D foundation). */
export function defaultDigitalAssetUrl(variantId: string, token: string): string {
  return `/digital/assets/${variantId}?token=${token}`;
}
