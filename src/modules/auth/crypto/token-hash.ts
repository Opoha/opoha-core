import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 hex digest for opaque tokens / API keys (never store plaintext). */
export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** URL-safe random secret (`prefix` + base64url). */
export function generateOpaqueToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}
